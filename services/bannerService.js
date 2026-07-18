const Banner = require('../models/Banner');
const logger = require('../utils/logger');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const fs = require('fs');

const invalidateBannerCache = async (vendorId) => {
    try {
        await redisService.del(redisKeys.banner(vendorId));
        logger.logInfo('Banner cache invalidated', { vendorId });
    } catch (err) {
        throw err;
    }
};

const getBannerCount = async (vendorId) => {
    try {
        return await Banner.countDocuments({ vendorId, isDeleted: false });
    } catch (err) {
        throw err;
    }
};

const addBanner = async (vendorId, bannerData, imagePath, existingCount) => {
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
                isDeleted: false
            });

            if (conflictExists) {
                await Banner.updateMany(
                    { vendorId, precedence: { $gte: precedence }, isDeleted: false },
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
            precedence
        });

        const saved = await banner.save();
        logger.logInfo('Banner added successfully', { vendorId, bannerId: saved._id });

        await invalidateBannerCache(vendorId);
        return saved;
    } catch (err) {
        throw err;
    }
};

const softDeleteBanner = async (vendorId, bannerId) => {
    try {
        const banner = await Banner.findOne({ _id: bannerId, vendorId, isDeleted: false });
        if (!banner) return { notFound: true };

        const wasDefault = banner.isDefault;

        // Delete image from filesystem
        if (banner.image && fs.existsSync(banner.image)) {
            fs.unlinkSync(banner.image);
            logger.logInfo('Banner image deleted from filesystem', { vendorId, bannerId });
        }

        banner.isDeleted = true;
        banner.isDefault = false;
        await banner.save();

        if (wasDefault) {
            const nextDefault = await Banner.findOne(
                { vendorId, isDeleted: false },
                null,
                { sort: { precedence: 1 } }
            );
            if (nextDefault) {
                nextDefault.isDefault = true;
                await nextDefault.save();
                logger.logInfo('New default banner assigned', { vendorId, bannerId: nextDefault._id });
            }
        }

        const remaining = await Banner.find(
            { vendorId, isDeleted: false },
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

        logger.logInfo('Banner soft deleted and precedences re-ordered', { vendorId, bannerId });
        await invalidateBannerCache(vendorId);
        return { deleted: true };
    } catch (err) {
        throw err;
    }
};

const updateBanner = async (vendorId, bannerId, updateData, newImagePath) => {
    try {
        const banner = await Banner.findOne({ _id: bannerId, vendorId, isDeleted: false });
        if (!banner) return null;

        const { name, isActive, startDate, endDate, isDefault, precedence } = updateData;

        if (precedence !== undefined && parseInt(precedence) !== banner.precedence) {
            const oldPrecedence = banner.precedence;
            const newPrecedence = parseInt(precedence);

            await Banner.updateMany(
                { vendorId, precedence: { $gt: oldPrecedence }, isDeleted: false, _id: { $ne: bannerId } },
                { $inc: { precedence: -1 } }
            );

            await Banner.updateMany(
                { vendorId, precedence: { $gte: newPrecedence }, isDeleted: false, _id: { $ne: bannerId } },
                { $inc: { precedence: 1 } }
            );

            banner.precedence = newPrecedence;
        }

        if (isDefault === true && !banner.isDefault) {
            await Banner.updateOne(
                { vendorId, isDefault: true, isDeleted: false },
                { $set: { isDefault: false } }
            );
            banner.isDefault = true;
        }

        // If new image uploaded, delete old one from filesystem
        if (newImagePath) {
            if (banner.image && fs.existsSync(banner.image)) {
                fs.unlinkSync(banner.image);
                logger.logInfo('Old banner image deleted from filesystem', { vendorId, bannerId });
            }
            banner.image = newImagePath;
        }

        if (name !== undefined) banner.name = name;
        if (isActive !== undefined) banner.isActive = isActive;
        if (startDate !== undefined) banner.startDate = startDate;
        if (endDate !== undefined) banner.endDate = endDate;

        const updated = await banner.save();
        logger.logInfo('Banner updated successfully', { vendorId, bannerId });
        await invalidateBannerCache(vendorId);
        return updated;
    } catch (err) {
        throw err;
    }
};

const fetchAllActiveBanners = async (vendorId) => {
    try {
        const banners = await Banner.find(
            { vendorId, isDeleted: false, isActive: true },
            null,
            { sort: { isDefault: -1, precedence: 1 } }
        );
        logger.logInfo('Active banners fetched from DB', { vendorId });
        return banners;
    } catch (err) {
        throw err;
    }
};

const fetchAllBannersAdmin = async (vendorId) => {
    try {
        const banners = await Banner.find(
            { vendorId, isDeleted: false },
            null,
            { sort: { isDefault: -1, precedence: 1 } }
        );
        logger.logInfo('All banners fetched from DB for admin', { vendorId });
        return banners;
    } catch (err) {
        throw err;
    }
};

const fetchBannerById = async (vendorId, bannerId) => {
    try {
        const banner = await Banner.findOne({ _id: bannerId, vendorId, isDeleted: false });
        if (!banner) return null;
        logger.logInfo('Banner fetched by ID', { vendorId, bannerId });
        return banner;
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