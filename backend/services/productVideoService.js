const mongoose = require('mongoose');
const Product = require('../models/Product');
const VideoAsset = require('../models/VideoAsset');
const videoUploadService = require('./videoUploadService');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');
const {
    PRODUCT_VIDEO_MODULE,
    UNUSED_PRODUCT_VIDEO_MAX_AGE_MS,
    UNUSED_PRODUCT_VIDEO_SCAN_INTERVAL_MS,
    UNUSED_PRODUCT_VIDEO_SCAN_BATCH_SIZE
} = require('../constants/productVideoConstants');

/*
|--------------------------------------------------------------------------
| PRODUCT VIDEOS
|--------------------------------------------------------------------------
| A product size holds an ordered list of videos (Product.variants.sizes.videos),
| shown in the storefront gallery at CompanySettings.productVideoPositionInGallery.
|
| Upload flow: the admin form uploads each video on its own as soon as it is
| picked (POST /products/upload-product-video -> a VideoAsset of module
| 'productVideo'), and the product save then lists the returned ids per size.
| Bulk upload/update does the same with the files of its videos zip.
|
| Switches: needs isVideoUploadingFeatureOn (the general video switch) AND
| isProductVideoFeatureOn, each in BOTH WebsiteMaster and CompanyMaster.
| Limits (CompanyMaster): numberOfVideoUploadAllowedInProduct (per product,
| across all sizes) and sizeOfVideoUploadAllowedInProduct (MB per video) -
| null = no limit. Formats: allowedVideoFormat (resolveAllowedVideoFormats).
|
| A VideoAsset can be shared by several products (cloning copies the
| references), so it is only ever removed once no non-deleted product points
| at it. Uploads that never get saved into a product are removed by the
| hourly unused-video clean-up once they are UNUSED_PRODUCT_VIDEO_MAX_AGE_MS old.
*/

const FEATURE_OFF_MESSAGE = 'Product videos are not enabled for your plan.';

let cleanupIntervalHandle = null;

const toIdString = (id) => {
    try {
        return id ? id.toString() : '';
    } catch (err) {
        throw err;
    }
};

// Both switches, in both masters (see the header).
const isProductVideoEnabled = (websiteMasterData, companyMasterData) => {
    try {
        return !!(websiteMasterData && companyMasterData
            && websiteMasterData.isVideoUploadingFeatureOn && companyMasterData.isVideoUploadingFeatureOn
            && websiteMasterData.isProductVideoFeatureOn && companyMasterData.isProductVideoFeatureOn);
    } catch (err) {
        throw err;
    }
};

// returnResult form of isProductVideoEnabled, with the same messages every
// other feature switch answers with.
const checkProductVideoFeature = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        const videoCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData, 'isVideoUploadingFeatureOn', 'isVideoUploadingFeatureOn'
        );
        if (!videoCheck.isSuccess) {
            return common.returnResult(false, videoCheck.statusCode, videoCheck.message || FEATURE_OFF_MESSAGE);
        }

        const productVideoCheck = await common.checkFeatureOnOrOff(
            vendorId, websiteMasterData, companyMasterData, 'isProductVideoFeatureOn', 'isProductVideoFeatureOn'
        );
        if (!productVideoCheck.isSuccess) {
            return common.returnResult(false, productVideoCheck.statusCode, productVideoCheck.message || FEATURE_OFF_MESSAGE);
        }

        return common.returnResult(true, 200, 'All Good');
    } catch (err) {
        throw err;
    }
};

const isSetLimit = (value) => {
    try {
        return value !== undefined && value !== null && value !== '';
    } catch (err) {
        throw err;
    }
};

// Most MB one product video may weigh, or null = no limit.
// CompanyMaster.sizeOfVideoUploadAllowedInProduct is the product limit; it
// never falls back to CompanyMaster.maxVideoSize. WebsiteMaster.maxVideoSize
// is the site-wide safety cap and applies on top whenever it is set (the
// smaller of the two wins).
const resolveProductVideoMaxSizeMB = (companyMasterData, websiteMasterData) => {
    try {
        const productLimit = isSetLimit(companyMasterData?.sizeOfVideoUploadAllowedInProduct)
            ? Number(companyMasterData.sizeOfVideoUploadAllowedInProduct)
            : null;
        const siteCap = websiteMasterData?.maxVideoSize ? Number(websiteMasterData.maxVideoSize) : null;

        if (productLimit !== null && siteCap !== null) return Math.min(productLimit, siteCap);
        if (productLimit !== null) return productLimit;
        return siteCap;
    } catch (err) {
        throw err;
    }
};

// Most videos one product may hold (all sizes together), or null = no limit.
const resolveProductVideoMaxCount = (companyMasterData) => {
    try {
        return isSetLimit(companyMasterData?.numberOfVideoUploadAllowedInProduct)
            ? Number(companyMasterData.numberOfVideoUploadAllowedInProduct)
            : null;
    } catch (err) {
        throw err;
    }
};

// Everything the admin form needs to know up front (GET /products/product-video-settings).
const getProductVideoSettings = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        const featureCheck = await checkProductVideoFeature(vendorId, websiteMasterData, companyMasterData);

        return common.returnResult(true, 200, 'Product video settings fetched successfully', {
            isEnabled: featureCheck.isSuccess,
            disabledMessage: featureCheck.isSuccess ? null : featureCheck.message,
            maxVideosPerProduct: resolveProductVideoMaxCount(companyMasterData),
            maxVideoSizeMB: resolveProductVideoMaxSizeMB(companyMasterData, websiteMasterData),
            allowedFormats: videoUploadService.resolveAllowedVideoFormats(companyMasterData, websiteMasterData)
        });
    } catch (err) {
        throw err;
    }
};

// What a stored video looks like in API responses.
const toVideoResponse = (videoAsset) => {
    try {
        return {
            videoAssetId: videoAsset._id,
            url: videoAsset.url,
            originalName: videoAsset.originalName || null,
            mimeType: videoAsset.mimeType || null,
            size: videoAsset.size ?? null
        };
    } catch (err) {
        throw err;
    }
};

// One video, from a temp file on disk (multer diskStorage, or a file a bulk
// run extracted from its videos zip). The temp file is always removed.
const uploadProductVideo = async ({ vendorId, userId, file, companyMasterData, websiteMasterData }) => {
    try {
        if (!file) {
            return common.returnResult(false, 400, 'Video file is required.');
        }

        let isHandedToUploadService = false;
        try {
            const featureCheck = await checkProductVideoFeature(vendorId, websiteMasterData, companyMasterData);
            if (!featureCheck.isSuccess) {
                return featureCheck;
            }

            const allowedFormats = videoUploadService.resolveAllowedVideoFormats(companyMasterData, websiteMasterData)
                .map((format) => String(format).toLowerCase());
            const extension = videoUploadService.getFileExtension(file.originalname);
            if (!allowedFormats.includes(extension)) {
                return common.returnResult(false, 400, `File format .${extension || '(none)'} is not allowed. Allowed formats: ${allowedFormats.join(', ')}.`);
            }

            const maxSizeMB = resolveProductVideoMaxSizeMB(companyMasterData, websiteMasterData);
            if (maxSizeMB !== null && file.size > maxSizeMB * 1024 * 1024) {
                return common.returnResult(false, 413, `Video "${file.originalname}" exceeds the allowed limit of ${maxSizeMB}MB.`);
            }

            // Size and format are checked above against the product rules, so
            // uploadVideo is given no fields of its own to check - it still
            // verifies the file's real content (magic bytes) before uploading.
            // The per-product count is checked when the product is saved.
            isHandedToUploadService = true;
            const uploadResult = await videoUploadService.uploadVideo({
                vendorId,
                module: PRODUCT_VIDEO_MODULE,
                file,
                userId,
                maxSizeField: null,
                allowedFormatsField: null,
                maxCountField: null,
                companyMasterData,
                websiteMasterData
            });
            if (!uploadResult.isSuccess) {
                return common.returnResult(false, uploadResult.statusCode, uploadResult.message);
            }

            return common.returnResult(true, 201, 'Video uploaded successfully', { video: toVideoResponse(uploadResult.meta.video) });
        } finally {
            if (!isHandedToUploadService) {
                await videoUploadService.cleanupTempFile(file.path);
            }
        }
    } catch (err) {
        throw err;
    }
};

// Whether any non-deleted product (optionally other than excludeProductId)
// still lists this video.
const isVideoAssetStillReferenced = async ({ videoAssetId, excludeProductId = null }) => {
    try {
        const query = { status: { $ne: 'D' }, 'variants.sizes.videos.videoAssetId': videoAssetId };
        if (excludeProductId) query._id = { $ne: excludeProductId };

        const existing = await Product.findOne(query).select('_id').lean();
        return !!existing;
    } catch (err) {
        throw err;
    }
};

// Removes the video from storage (VideoAsset -> 'D') unless another product still uses it.
const deleteVideoIfUnreferenced = async ({ videoAssetId, userId, excludeProductId = null }) => {
    try {
        const stillReferenced = await isVideoAssetStillReferenced({ videoAssetId, excludeProductId });
        if (stillReferenced) return;

        const video = await VideoAsset.findOne({ _id: videoAssetId, status: { $ne: 'D' } }).select('_id').lean();
        if (!video) return;

        await videoUploadService.deleteVideo({ videoId: videoAssetId, userId });
    } catch (err) {
        throw err;
    }
};

// Same guard, but only marks the VideoAsset inactive (product made inactive).
const deactivateVideoIfUnreferenced = async ({ videoAssetId, userId, excludeProductId = null }) => {
    try {
        const stillReferenced = await isVideoAssetStillReferenced({ videoAssetId, excludeProductId });
        if (stillReferenced) return;
        await common.setActiveStatusToFalse(VideoAsset, videoAssetId, userId);
    } catch (err) {
        throw err;
    }
};

// Product made active again - always safe, no guard needed.
const reactivateVideo = async ({ videoAssetId, userId }) => {
    try {
        await common.setActiveStatusToTrue(VideoAsset, videoAssetId, userId);
    } catch (err) {
        throw err;
    }
};

// Every distinct videoAssetId a product (or a plain variants array) lists.
const collectProductVideoAssetIds = (productOrVariants) => {
    try {
        const variants = Array.isArray(productOrVariants) ? productOrVariants : (productOrVariants?.variants || []);
        const ids = new Map();
        for (const variant of variants) {
            for (const size of (variant.sizes || [])) {
                for (const video of (size.videos || [])) {
                    if (video && video.videoAssetId) ids.set(toIdString(video.videoAssetId), video.videoAssetId);
                }
            }
        }
        return [...ids.values()];
    } catch (err) {
        throw err;
    }
};

// Best-effort removal of videos uploaded by a request (bulk run) whose
// product then failed to save. Never throws - it must not hide the real failure.
const discardUploadedVideos = async (videoAssetIds, userId) => {
    try {
        for (const videoAssetId of (videoAssetIds || [])) {
            try {
                await deleteVideoIfUnreferenced({ videoAssetId, userId });
            } catch (err) {
                logger.logWarning('productVideoService - discardUploadedVideos: could not remove an unused video', { videoAssetId, error: err });
            }
        }
    } catch (err) {
        throw err;
    }
};

// The admin form removing a video it uploaded but never saved into the product
// (DELETE /products/product-video/:videoId). A video that a product already
// lists is removed by saving that product without it instead.
const discardProductVideo = async ({ vendorId, userId, videoAssetId }) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(videoAssetId)) {
            return common.returnResult(false, 400, 'Video id is invalid.');
        }

        const video = await VideoAsset.findOne({
            _id: videoAssetId, vendorId, module: PRODUCT_VIDEO_MODULE, status: { $ne: 'D' }
        }).select('_id').lean();
        if (!video) {
            return common.returnResult(false, 404, 'Video not found.');
        }

        const stillReferenced = await isVideoAssetStillReferenced({ videoAssetId });
        if (stillReferenced) {
            return common.returnResult(false, 409, 'This video is used by a product. Remove it from the product and save the product instead.');
        }

        await videoUploadService.deleteVideo({ videoId: videoAssetId, userId });
        logger.logInfo(1, 0, 'Unsaved product video removed', { vendorId, videoAssetId });

        return common.returnResult(true, 200, 'Video removed successfully');
    } catch (err) {
        throw err;
    }
};

// An entry of a size's `videos` as it arrives: a plain id (the form / a bulk
// run) or an already-stored { url, videoAssetId } (carried forward on update).
const videoEntryId = (entry) => {
    try {
        if (!entry) return null;
        if (typeof entry === 'string' || entry instanceof mongoose.Types.ObjectId) return entry;
        return entry.videoAssetId || null;
    } catch (err) {
        throw err;
    }
};

// Turns every size's `videos` (ids, in order) into stored { url, videoAssetId }
// entries, in place, and enforces the rules:
//  - one video at most once per product;
//  - the per-product count limit - only when the product would hold MORE
//    videos than it already does, so a lowered limit never blocks editing
//    other fields of an older product;
//  - adding a video needs the feature on (videos already on the product may stay);
//  - every id must be a live product video of this vendor; a NEW one must be active.
// existingProduct = the product being updated (null on create).
const resolveProductSizeVideos = async ({ vendorId, variants, existingProduct = null, companyMasterData, websiteMasterData }) => {
    try {
        const existingIds = new Set(collectProductVideoAssetIds(existingProduct).map(toIdString));

        const orderedIds = [];
        const seen = new Set();
        for (const variant of (variants || [])) {
            for (const size of (variant.sizes || [])) {
                for (const entry of (size.videos || [])) {
                    // An id that didn't decode arrives as null.
                    const id = toIdString(videoEntryId(entry));
                    if (!id) {
                        return common.returnResult(false, 400, `A video id in "${size.sizeName || 'a size'}" is invalid.`);
                    }
                    if (seen.has(id)) {
                        return common.returnResult(false, 400, `The same video is listed more than once in "${size.sizeName || 'a size'}" or across sizes. Each video can be used only once per product.`);
                    }
                    if (!mongoose.Types.ObjectId.isValid(id)) {
                        return common.returnResult(false, 400, 'A video id is invalid.');
                    }
                    seen.add(id);
                    orderedIds.push(id);
                }
            }
        }

        const newIds = orderedIds.filter((id) => !existingIds.has(id));

        if (newIds.length > 0) {
            const featureCheck = await checkProductVideoFeature(vendorId, websiteMasterData, companyMasterData);
            if (!featureCheck.isSuccess) {
                return common.returnResult(false, featureCheck.statusCode, `${featureCheck.message} Therefore you can't add videos to the product.`);
            }
        }

        const maxCount = resolveProductVideoMaxCount(companyMasterData);
        if (maxCount !== null && orderedIds.length > maxCount && orderedIds.length > existingIds.size) {
            return common.returnResult(false, 403, `A product can have at most ${maxCount} video(s) across all its sizes. This product would have ${orderedIds.length}.`);
        }

        const assets = orderedIds.length > 0
            ? await VideoAsset.find({
                _id: { $in: orderedIds }, vendorId, module: PRODUCT_VIDEO_MODULE, status: { $ne: 'D' }
            }).select('_id url status').lean()
            : [];
        const assetsById = new Map(assets.map((asset) => [toIdString(asset._id), asset]));

        for (const id of orderedIds) {
            const asset = assetsById.get(id);
            if (!asset) {
                return common.returnResult(false, 400, 'One of the videos was not found (it may have been removed). Please upload it again.');
            }
            if (!existingIds.has(id) && asset.status !== 'A') {
                return common.returnResult(false, 400, 'One of the videos is no longer active. Please upload it again.');
            }
        }

        for (const variant of (variants || [])) {
            for (const size of (variant.sizes || [])) {
                size.videos = (size.videos || [])
                    .map((entry) => assetsById.get(toIdString(videoEntryId(entry))))
                    .filter(Boolean)
                    .map((asset) => ({ url: asset.url, videoAssetId: asset._id }));
            }
        }

        return common.returnResult(true, 200, 'All Good', { videoCount: orderedIds.length, newVideoIds: newIds });
    } catch (err) {
        throw err;
    }
};

// After an update is saved: every video the product no longer lists is removed
// (unless another product still uses it).
const cleanUpRemovedProductVideos = async ({ previousVideoIds, product, userId }) => {
    try {
        const keptIds = new Set(collectProductVideoAssetIds(product).map(toIdString));
        for (const videoAssetId of (previousVideoIds || [])) {
            if (keptIds.has(toIdString(videoAssetId))) continue;
            try {
                await deleteVideoIfUnreferenced({ videoAssetId, userId, excludeProductId: product._id });
            } catch (err) {
                logger.logWarning('productVideoService - cleanUpRemovedProductVideos: could not remove a video', { videoAssetId, productId: product._id, error: err });
            }
        }
    } catch (err) {
        throw err;
    }
};

// Storefront: the videos and gallery settings a shopper gets. With the
// feature off the videos are hidden (they stay stored, so switching it back
// on brings them back).
const applyStorefrontVideoSettings = (shapedProduct, { websiteMasterData, companyMasterData, companySettingsData }) => {
    try {
        if (!shapedProduct) return shapedProduct;

        const isEnabled = isProductVideoEnabled(websiteMasterData, companyMasterData);
        if (!isEnabled) {
            for (const variant of (shapedProduct.variants || [])) {
                for (const size of (variant.sizes || [])) {
                    size.videos = [];
                }
            }
        }

        const position = Number(companySettingsData?.productVideoPositionInGallery);
        shapedProduct.videoGallery = {
            position: Number.isInteger(position) && position >= 1 ? position : 1,
            autoplay: companySettingsData?.isProductVideoAutoplayOn !== false
        };
        return shapedProduct;
    } catch (err) {
        throw err;
    }
};

// Storefront product lists only ever show the main image - never send videos there.
const stripProductVideos = (shapedProduct) => {
    try {
        if (!shapedProduct) return shapedProduct;
        for (const variant of (shapedProduct.variants || [])) {
            for (const size of (variant.sizes || [])) {
                delete size.videos;
            }
        }
        return shapedProduct;
    } catch (err) {
        throw err;
    }
};

// Removes product videos that no product points at once they are old enough
// (an admin who uploaded videos and then left the form without saving).
const cleanUpUnusedProductVideos = async () => {
    try {
        const cutoff = new Date(Date.now() - UNUSED_PRODUCT_VIDEO_MAX_AGE_MS);
        let lastId = null;
        let removedCount = 0;

        for (;;) {
            const filter = { module: PRODUCT_VIDEO_MODULE, status: { $ne: 'D' }, createdAt: { $lt: cutoff } };
            if (lastId) filter._id = { $gt: lastId };

            const batch = await VideoAsset.find(filter).select('_id').sort({ _id: 1 })
                .limit(UNUSED_PRODUCT_VIDEO_SCAN_BATCH_SIZE).lean();
            if (batch.length === 0) break;
            lastId = batch[batch.length - 1]._id;

            const batchIds = batch.map((video) => video._id);
            const referenced = await Product.distinct('variants.sizes.videos.videoAssetId', {
                status: { $ne: 'D' }, 'variants.sizes.videos.videoAssetId': { $in: batchIds }
            });
            const referencedIds = new Set(referenced.map(toIdString));

            for (const videoAssetId of batchIds) {
                if (referencedIds.has(toIdString(videoAssetId))) continue;
                try {
                    await videoUploadService.deleteVideo({ videoId: videoAssetId, userId: null });
                    removedCount++;
                } catch (err) {
                    logger.logWarning('productVideoService - cleanUpUnusedProductVideos: could not remove a video', { videoAssetId, error: err });
                }
            }

            if (batch.length < UNUSED_PRODUCT_VIDEO_SCAN_BATCH_SIZE) break;
        }

        if (removedCount > 0) {
            logger.logInfo(1, 0, 'Unused product videos removed', { count: removedCount });
        }
        return removedCount;
    } catch (err) {
        throw err;
    }
};

const runLockedUnusedVideoCleanUp = async () => {
    try {
        const acquired = await redisService.acquireLock(
            redisKeys.unusedProductVideoCleanupLock(), Math.floor(UNUSED_PRODUCT_VIDEO_SCAN_INTERVAL_MS / 1000)
        );
        if (!acquired) return;
        await cleanUpUnusedProductVideos();
    } catch (err) {
        logger.logWarning('productVideoService - runLockedUnusedVideoCleanUp: clean-up failed', { error: err });
    }
};

const startUnusedProductVideoCleanup = () => {
    try {
        if (cleanupIntervalHandle) return;
        cleanupIntervalHandle = setInterval(runLockedUnusedVideoCleanUp, UNUSED_PRODUCT_VIDEO_SCAN_INTERVAL_MS);
        logger.logInfo(1, 0, 'Unused product video clean-up started', { intervalMs: UNUSED_PRODUCT_VIDEO_SCAN_INTERVAL_MS });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    isProductVideoEnabled,
    checkProductVideoFeature,
    resolveProductVideoMaxSizeMB,
    resolveProductVideoMaxCount,
    getProductVideoSettings,
    uploadProductVideo,
    discardProductVideo,
    isVideoAssetStillReferenced,
    deleteVideoIfUnreferenced,
    deactivateVideoIfUnreferenced,
    reactivateVideo,
    collectProductVideoAssetIds,
    discardUploadedVideos,
    resolveProductSizeVideos,
    cleanUpRemovedProductVideos,
    applyStorefrontVideoSettings,
    stripProductVideos,
    cleanUpUnusedProductVideos,
    runLockedUnusedVideoCleanUp,
    startUnusedProductVideoCleanup
};
