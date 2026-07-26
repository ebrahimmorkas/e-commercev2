const Banner = require('../models/Banner');
const logger = require('../utils/logger');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const fs = require('fs');

const invalidateBannerCache = async (vendorId) => {
    try {
        await redisService.del(redisKeys.banner(vendorId));
        logger.logInfo(1,0,'Banner cache invalidated', { vendorId });
    } catch (err) {
        throw err;
    }
};

const getBannerCount = async (vendorId) => {
    try {
        const count = await Banner.countDocuments({ vendorId, status: { $ne: 'D' } });
        if (count == 0) {
            return common.returnResult(false, 404, `No records to show`);
        }
        return common.returnResult(true, 200, 'Banner count fetched successfully', { count });
    } catch (err) {
        throw err;
    }
};

const addBanner = async (vendorId, bannerData, imagePath, existingCount, userId) => {
    try {
        const isDefault = existingCount === 0;

        let { precedence } = bannerData;

        if (!precedence) {
            precedence = existingCount + 1;
        } else {
            precedence = parseInt(precedence);
            const conflictExists = await Banner.exists({
                vendorId,
                precedence,
                status: { $ne: 'D' }
            });

            if (conflictExists) {
                await Banner.updateMany(
                    { vendorId, precedence: { $gte: precedence }, status: { $ne: 'D' } },
                    { $inc: { precedence: 1 } }
                );
            }
        }

        const banner = new Banner({
            vendorId,
            name: bannerData.name,
            image: imagePath,
            startDate: bannerData.startDate,
            endDate: bannerData.endDate,
            isDefault,
            precedence,
            createdBy: userId
        });

        const saved = await banner.save();
        logger.logInfo(1,0,'Banner added successfully', { vendorId, bannerId: saved._id });

        await invalidateBannerCache(vendorId);
        return common.returnResult(true, 201, 'Banner added successfully', { banner: saved });
    } catch (err) {
        throw err;
    }
};

const softDeleteBanner = async (vendorId, bannerId, userId) => {
    try {
        const banner = await Banner.findOne({ _id: bannerId, vendorId, status: { $ne: 'D' } });
        if (!banner) {
            return common.returnResult(false, 404, 'Banner not found', {});
        }

        const wasDefault = banner.isDefault;

        // Delete image from filesystem
        if (banner.image && fs.existsSync(banner.image)) {
            fs.unlinkSync(banner.image);
            logger.logInfo(1,0,'Banner image deleted from filesystem', { vendorId, bannerId });
        }

        banner.status = 'D';
        banner.isDefault = false;
        banner.deletedBy = userId;
        await banner.save();

        if (wasDefault) {
            const nextDefault = await Banner.findOne(
                { vendorId, status: { $ne: 'D' } },
                null,
                { sort: { precedence: 1 } }
            );
            if (nextDefault) {
                nextDefault.isDefault = true;
                await nextDefault.save();
                logger.logInfo(1,0,'New default banner assigned', { vendorId, bannerId: nextDefault._id });
            }
        }

        const remaining = await Banner.find(
            { vendorId, status: { $ne: 'D' } },
            null,
            { sort: { precedence: 1 } }
        );

        const bulkOps = remaining.map((ban, index) => ({
            updateOne: {
                filter: { _id: ban._id },
                update: { $set: { precedence: index + 1 } }
            }
        }));

        if (bulkOps.length > 0) {
            await Banner.bulkWrite(bulkOps);
        }

        logger.logInfo(1,0,'Banner soft deleted and precedences re-ordered', { vendorId, bannerId });
        await invalidateBannerCache(vendorId);
        return common.returnResult(true, 200, 'Banner deleted successfully', {});
    } catch (err) {
        throw err;
    }
};

const updateBanner = async (vendorId, bannerId, updateData, newImagePath, userId) => {
    try {
        const banner = await Banner.findOne({ _id: bannerId, vendorId, status: { $ne: 'D' } });
        if (!banner) {
            return common.returnResult(false, 404, 'Banner not found', {});
        }

        const { name, status, startDate, endDate, isDefault, precedence } = updateData;

        if (precedence !== undefined && parseInt(precedence) !== banner.precedence) {
            const oldPrecedence = banner.precedence;
            const newPrecedence = parseInt(precedence);

            await Banner.updateMany(
                { vendorId, precedence: { $gt: oldPrecedence }, status: { $ne: 'D' }, _id: { $ne: bannerId } },
                { $inc: { precedence: -1 } }
            );

            await Banner.updateMany(
                { vendorId, precedence: { $gte: newPrecedence }, status: { $ne: 'D' }, _id: { $ne: bannerId } },
                { $inc: { precedence: 1 } }
            );

            banner.precedence = newPrecedence;
        }

        if (isDefault === true && !banner.isDefault) {
            await Banner.updateOne(
                { vendorId, isDefault: true, status: { $ne: 'D' } },
                { $set: { isDefault: false } }
            );
            banner.isDefault = true;
        }

        if (status !== undefined && status !== banner.status) {
            if (status === 'A') {
                banner.activeMarkedBy = userId;
                banner.activeMarkedDate = new Date();
            } else if (status === 'I') {
                banner.inActiveMarkedBy = userId;
                banner.inactiveMarkedDate = new Date();
            }
            banner.status = status;
        }

        // If new image uploaded, delete old one from filesystem
        if (newImagePath) {
            if (banner.image && fs.existsSync(banner.image)) {
                fs.unlinkSync(banner.image);
                logger.logInfo(1,0,'Old banner image deleted from filesystem', { vendorId, bannerId });
            }
            banner.image = newImagePath;
        }

        if (name !== undefined) banner.name = name;
        if (startDate !== undefined) banner.startDate = startDate;
        if (endDate !== undefined) banner.endDate = endDate;

        banner.updatedBy = userId;

        const updated = await banner.save();
        logger.logInfo(1,0,'Banner updated successfully', { vendorId, bannerId });
        await invalidateBannerCache(vendorId);
        return common.returnResult(true, 200, 'Banner updated successfully', { banner: updated });
    } catch (err) {
        throw err;
    }
};

const fetchAllActiveBanners = async (vendorId) => {
    try {
        const banners = await Banner.find(
            { vendorId, status: 'A', endDate: { $gte: new Date() } },
            null,
            { sort: { isDefault: -1, precedence: 1 } }
        );
        if(banners.length < 0) {
            return common.returnResult(false, 404, `No records to show`);
        }
        logger.logInfo(1,0,'Active banners fetched from DB', { vendorId });
        return common.returnResult(true, 200, 'Banners fetched successfully', { banners });
    } catch (err) {
        throw err;
    }
};

const fetchAllBannersAdmin = async (vendorId) => {
    try {
        const banners = await Banner.find(
            { vendorId, status: { $in: ['A', 'I'] } },
            null,
            { sort: { isDefault: -1, precedence: 1 } }
        );
        if(banners.length < 0) {
            return common.returnResult(false, 404, `No records to show`);
        }
        logger.logInfo(1,0,'All banners fetched from DB for admin', { vendorId });
        return common.returnResult(true, 200, 'Banners fetched successfully', { banners });
    } catch (err) {
        throw err;
    }
};

const fetchBannerById = async (vendorId, bannerId) => {
    try {
        const banner = await Banner.findOne({ _id: bannerId, vendorId, status: { $ne: 'D' } });
        if (!banner) {
            return common.returnResult(false, 404, 'Banner not found', {});
        }
        logger.logInfo(1,0,'Banner fetched by ID', { vendorId, bannerId });
        return common.returnResult(true, 200, 'Banner fetched successfully', { banner });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getBannerCount,
    addBanner,
    softDeleteBanner,
    updateBanner,
    fetchAllActiveBanners,
    fetchAllBannersAdmin,
    fetchBannerById
};