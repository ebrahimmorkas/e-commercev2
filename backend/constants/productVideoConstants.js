// Product videos - see services/productVideoService.js.

// VideoAsset.module of every product video.
const PRODUCT_VIDEO_MODULE = 'productVideo';

// Multipart field name of the single-video upload (POST /products/upload-product-video).
const PRODUCT_VIDEO_FIELD_NAME = 'video';

// Upper bound for CompanySettings.productVideoPositionInGallery.
const MAX_PRODUCT_VIDEO_POSITION_IN_GALLERY = 100;

// Most videos one size may list, whatever the product limit says - a guard
// against absurd payloads (CompanyMaster.numberOfVideoUploadAllowedInProduct
// is the real, per-product limit).
const MAX_VIDEOS_PER_SIZE = 50;

// Unused-upload cleanup: a product video that no product points at is removed
// once it is this old. The admin form uploads a video the moment it is picked,
// before the product is saved, so a younger one may still be on an open form.
const UNUSED_PRODUCT_VIDEO_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const UNUSED_PRODUCT_VIDEO_SCAN_INTERVAL_MS = 60 * 60 * 1000;
const UNUSED_PRODUCT_VIDEO_SCAN_BATCH_SIZE = 200;

module.exports = {
    PRODUCT_VIDEO_MODULE,
    PRODUCT_VIDEO_FIELD_NAME,
    MAX_PRODUCT_VIDEO_POSITION_IN_GALLERY,
    MAX_VIDEOS_PER_SIZE,
    UNUSED_PRODUCT_VIDEO_MAX_AGE_MS,
    UNUSED_PRODUCT_VIDEO_SCAN_INTERVAL_MS,
    UNUSED_PRODUCT_VIDEO_SCAN_BATCH_SIZE
};
