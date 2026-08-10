const express = require('express');
const router = express.Router();

const authenticate = require('../middlewares/authenticate');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const upload = require('../middlewares/imageUploadM');
const imageUploadController = require('../controllers/imageUploadController');

// These generic routes are here mainly for direct/manual testing of the service.
// In practice, module-specific controllers (bannerController, categoryController, etc.)
// should require imageUploadService directly and call its functions, passing the
// field names relevant to that module (maxSizeField, allowedFormatsField, maxCountField).

router.post(
    '/images',
    authenticate,
    vendorDetection,
    ensureVendorDataCached,
    upload.single('image'),
    imageUploadController.uploadImage
);

router.get(
    '/images',
    authenticate,
    vendorDetection,
    imageUploadController.getImages
);

router.get(
    '/images/:imageId',
    authenticate,
    vendorDetection,
    imageUploadController.getImageById
);

router.put(
    '/images/:imageId',
    authenticate,
    vendorDetection,
    ensureVendorDataCached,
    upload.single('image'),
    imageUploadController.updateImage
);

router.delete(
    '/images/:imageId',
    authenticate,
    vendorDetection,
    imageUploadController.deleteImage
);

module.exports = router;