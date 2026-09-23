const Banner = require('../models/Banner');
const logger = require('../utils/logger');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const imageUploadService = require('./imageUploadService');
const videoUploadService = require('./videoUploadService');
const fs = require('fs/promises');

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
            return common.returnResult(false, 404, `No records to show`, {count});
        }
        return common.returnResult(true, 200, 'Banner count fetched successfully', { count });
    } catch (err) {
        throw err;
    }
};

// bannerMediaUpload (multer) writes the image field to a temp file on disk (same as
// the video field), but imageUploadService's contract expects file.buffer - this
// bridges the two. Banners are the only image consumer with this adapter because
// they're also the only one that needs a single multer instance shared with video.
const cleanupTempFile = async (filePath) => {
    if (!filePath) return;
    try {
        await fs.unlink(filePath);
    } catch (err) {
        if (err.code !== 'ENOENT') logger.logWarning('bannerService - cleanupTempFile: Exception while deleting temp file', err);
    }
};

const toBufferedImageFile = async (diskFile) => {
    const buffer = await fs.readFile(diskFile.path);
    return { ...diskFile, buffer };
};

// Uploads whichever media file was provided (exactly one of imageFile/videoFile -
// enforced upstream in bannerValidations.js) and returns the Banner fields to set.
const uploadBannerMedia = async ({ vendorId, imageFile, videoFile, userId, companyMasterData, websiteMasterData }) => {
    if (imageFile) {
        try {
            const bufferedImage = await toBufferedImageFile(imageFile);
            const uploadResult = await imageUploadService.uploadImage({
                vendorId,
                module: 'banner',
                file: bufferedImage,
                userId,
                maxSizeField: 'allowedBannerImagesMB',
                companyMasterData,
                websiteMasterData
            });
            if (!uploadResult.isSuccess) {
                return { result: common.returnResult(false, uploadResult.statusCode, uploadResult.message) };
            }
            const imageAsset = uploadResult.meta.image;
            return { fields: { image: imageAsset.url, imageAssetId: imageAsset._id, video: undefined, videoAssetId: undefined } };
        } finally {
            await cleanupTempFile(imageFile.path);
        }
    }

    if (videoFile) {
        const uploadResult = await videoUploadService.uploadVideo({
            vendorId,
            module: 'banner',
            file: videoFile,
            userId,
            maxSizeField: 'allowedBannerVideoMB',
            companyMasterData,
            websiteMasterData
        });
        if (!uploadResult.isSuccess) {
            return { result: common.returnResult(false, uploadResult.statusCode, uploadResult.message) };
        }
        const videoAsset = uploadResult.meta.video;
        return { fields: { video: videoAsset.url, videoAssetId: videoAsset._id, image: undefined, imageAssetId: undefined } };
    }

    return { fields: {} };
};

const addBanner = async (vendorId, bannerData, imageFile, videoFile, existingCount, userId, companyMasterData, websiteMasterData) => {
    try {
        const mediaResult = await uploadBannerMedia({ vendorId, imageFile, videoFile, userId, companyMasterData, websiteMasterData });
        if (mediaResult.result) {
            return mediaResult.result;
        }

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
            ...mediaResult.fields,
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

        // Delete the underlying media asset (whichever of the two this banner has)
        if (banner.imageAssetId) {
            const imageDeleteResult = await imageUploadService.deleteImage({ imageId: banner.imageAssetId, userId });
            if (!imageDeleteResult.isSuccess) {
                return common.returnResult(false, imageDeleteResult.statusCode, imageDeleteResult.message);
            }
        } else if (banner.videoAssetId) {
            const videoDeleteResult = await videoUploadService.deleteVideo({ videoId: banner.videoAssetId, userId });
            if (!videoDeleteResult.isSuccess) {
                return common.returnResult(false, videoDeleteResult.statusCode, videoDeleteResult.message);
            }
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

const updateBanner = async (vendorId, bannerId, updateData, newImageFile, newVideoFile, userId, companyMasterData, websiteMasterData) => {
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

        // Old asset ids are captured now and only cleaned up AFTER the new media
        // has been uploaded and the banner successfully saved pointing at it -
        // never before. Deleting (or in-place overwriting) the old asset first
        // meant a failed/rejected new upload left the banner with no working
        // media and destroyed the only record of the asset that used to be
        // there, with no way to trace or recover it.
        const oldImageAssetId = banner.imageAssetId;
        const oldVideoAssetId = banner.videoAssetId;

        if (newImageFile) {
            try {
                const bufferedImage = await toBufferedImageFile(newImageFile);
                const uploadResult = await imageUploadService.uploadImage({
                    vendorId, module: 'banner', file: bufferedImage, userId,
                    maxSizeField: 'allowedBannerImagesMB', companyMasterData, websiteMasterData
                });
                if (!uploadResult.isSuccess) {
                    return common.returnResult(false, uploadResult.statusCode, uploadResult.message);
                }
                banner.image = uploadResult.meta.image.url;
                banner.imageAssetId = uploadResult.meta.image._id;
                banner.video = undefined;
                banner.videoAssetId = undefined;
            } finally {
                await cleanupTempFile(newImageFile.path);
            }
        } else if (newVideoFile) {
            const uploadResult = await videoUploadService.uploadVideo({
                vendorId, module: 'banner', file: newVideoFile, userId,
                maxSizeField: 'allowedBannerVideoMB', companyMasterData, websiteMasterData
            });
            if (!uploadResult.isSuccess) {
                return common.returnResult(false, uploadResult.statusCode, uploadResult.message);
            }
            banner.video = uploadResult.meta.video.url;
            banner.videoAssetId = uploadResult.meta.video._id;
            banner.image = undefined;
            banner.imageAssetId = undefined;
        }

        if (name !== undefined) banner.name = name;
        if (startDate !== undefined) banner.startDate = startDate;
        if (endDate !== undefined) banner.endDate = endDate;

        banner.updatedBy = userId;

        const updated = await banner.save();

        // Only now that the banner durably points at the new asset is it safe to
        // remove whichever old one it used to have (soft-deletes it - see
        // deleteImage/deleteVideo - so even if this step itself fails, the old
        // asset's record, key and url are never lost).
        if (newImageFile || newVideoFile) {
            if (oldImageAssetId) {
                await imageUploadService.deleteImage({ imageId: oldImageAssetId, userId });
            }
            if (oldVideoAssetId) {
                await videoUploadService.deleteVideo({ videoId: oldVideoAssetId, userId });
            }
        }

        logger.logInfo(1,0,'Banner updated successfully', { vendorId, bannerId });
        await invalidateBannerCache(vendorId);
        return common.returnResult(true, 200, 'Banner updated successfully', { banner: updated });
    } catch (err) {
        throw err;
    }
};

// Single-banner status flip used only by the bulk endpoint below - a fresh,
// minimal function rather than reusing updateBanner (which also handles
// media/precedence/isDefault, none of which apply to a bulk status change).
const setBannerStatusForBulk = async (vendorId, userId, bannerId, status) => {
    try {
        const banner = await Banner.findOne({ _id: bannerId, vendorId, status: { $ne: 'D' } });
        if (!banner) {
            return common.returnResult(false, 404, 'Banner not found');
        }

        if (status === 'A') {
            banner.activeMarkedBy = userId;
            banner.activeMarkedDate = new Date();
        } else {
            banner.inActiveMarkedBy = userId;
            banner.inactiveMarkedDate = new Date();
        }
        banner.status = status;
        banner.updatedBy = userId;

        await banner.save();
        return common.returnResult(true, 200, `Banner ${status === 'A' ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
        throw err;
    }
};

const bulkSetBannerStatus = async (vendorId, userId, bannerIds, status) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            bannerIds,
            (id) => setBannerStatusForBulk(vendorId, userId, id, status)
        );

        if (successCount > 0) {
            await invalidateBannerCache(vendorId);
        }

        logger.logInfo(successCount, failureCount, 'Bulk banner status update completed', { vendorId, status, successCount, failureCount });

        return common.returnResult(
            true, 200,
            `${status === 'A' ? 'Activated' : 'Deactivated'} ${successCount} of ${bannerIds.length} banner(s).`,
            { results, successCount, failureCount }
        );
    } catch (err) {
        throw err;
    }
};

const bulkDeleteBanners = async (vendorId, userId, bannerIds) => {
    try {
        const { results, successCount, failureCount } = await common.runBulkOperation(
            bannerIds,
            (id) => softDeleteBanner(vendorId, id, userId)
        );

        logger.logInfo(successCount, failureCount, 'Bulk banner delete completed', { vendorId, successCount, failureCount });

        return common.returnResult(
            true, 200,
            `Deleted ${successCount} of ${bannerIds.length} banner(s).`,
            { results, successCount, failureCount }
        );
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
    bulkSetBannerStatus,
    bulkDeleteBanners,
    fetchAllActiveBanners,
    fetchAllBannersAdmin,
    fetchBannerById
};
