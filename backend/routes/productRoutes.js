const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const validate = require('../middlewares/validate');
const { createProductSchema } = require('../middlewares/validations/productValidations');

const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
// Adjust this path to wherever imageUpload.js actually lives in your project
// (assumed here to be middlewares/multer/imageUpload.js, alongside
// diskFileUpload.js / memoryFileUpload.js / bulkFileUpload.js).
const imageUpload = require('../middlewares/imageUpload');
const common = require('../utils/common');

// authenticate/authorize('admin') intentionally left off for now, matching
// the old productRoutes.js /add-product (which also had none, and
// productController.js had a hardcoded userId placeholder for the same
// reason) - wire both in together whenever this route is meant to be
// admin-only.

// ---------------------------------------------------------------------------
// Single combined endpoint: request body is multipart/form-data with:
//   - field "data": the full product JSON payload (exact shape
//     createProductSchema below validates), stringified.
//   - field "sizeImage_<v>_<s>": ONE file - main image for
//     variants[v].sizes[s]. Optional.
//   - field "sizeAdditionalImages_<v>_<s>": ONE OR MORE image files
//     (repeat the same field name for multiple), OR a single .zip
//     containing several images - either form is accepted under this same
//     field name. Optional.
// v/s are the variant/size's position inside the "variants" array in the
// JSON payload (0-based) - not any _id, since new variants/sizes don't have
// one yet at creation time.
//
// This inline middleware unwraps "data" back into req.body before Joi runs,
// so createProductSchema itself needs no awareness of multipart at all.
// ---------------------------------------------------------------------------
const parseProductData = (req, res, next) => {
    try {
        if (!req.body || !req.body.data) {
            return common.sendError(res, 400, 'Missing "data" field containing the product JSON payload.');
        }
        req.body = JSON.parse(req.body.data);
        next();
    } catch (err) {
        return common.sendError(res, 400, 'Invalid JSON in "data" field.');
    }
};

router.post(
    '/add-product',
    vendorDetection,
    ensureVendorDataCached,
    imageUpload.any(),
    parseProductData,
    validate(createProductSchema, 'body'),
    productController.createProduct
);

module.exports = router;