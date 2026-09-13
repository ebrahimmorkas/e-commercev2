const express = require('express');
const router = express.Router();

const authenticate = require('../middlewares/authenticate');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const validate = require('../middlewares/validate');
const videoUpload = require('../middlewares/videoUpload');
const videoUploadController = require('../controllers/videoUploadController');
const {
    uploadVideoSchema,
    updateVideoSchema,
    videoIdParamSchema,
    getVideosQuerySchema
} = require('../middlewares/validations/videoUploadValidations');

// These generic routes are here mainly for direct/manual testing of the service.
// In practice, module-specific controllers (productController, etc.) should
// require videoUploadService directly and call its functions, passing the
// field names relevant to that module (maxSizeField, allowedFormatsField, maxCountField).

router.post(
    '/videos',
    authenticate,
    vendorDetection,
    ensureVendorDataCached,
    videoUpload,
    validate(uploadVideoSchema, 'body'),
    videoUploadController.uploadVideo
);

router.get(
    '/videos',
    authenticate,
    vendorDetection,
    validate(getVideosQuerySchema, 'query'),
    videoUploadController.getVideos
);

router.get(
    '/videos/:videoId',
    authenticate,
    vendorDetection,
    validate(videoIdParamSchema, 'params'),
    videoUploadController.getVideoById
);

router.put(
    '/videos/:videoId',
    authenticate,
    vendorDetection,
    ensureVendorDataCached,
    validate(videoIdParamSchema, 'params'),
    videoUpload,
    validate(updateVideoSchema, 'body'),
    videoUploadController.updateVideo
);

router.delete(
    '/videos/:videoId',
    authenticate,
    vendorDetection,
    validate(videoIdParamSchema, 'params'),
    videoUploadController.deleteVideo
);

module.exports = router;
