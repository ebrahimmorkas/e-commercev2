const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const validate = require('../middlewares/validate');
const { createProductSchema, idParamSchema  } = require('../middlewares/validations/productValidations');

const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
// Adjust this path to wherever imageUpload.js actually lives in your project
// (assumed here to be middlewares/multer/imageUpload.js, alongside
// diskFileUpload.js / memoryFileUpload.js / bulkFileUpload.js).
const imageUpload = require('../middlewares/imageUpload');
const common = require('../utils/common');

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

router.get(
    '/get-products-admin',
    vendorDetection,
    ensureVendorDataCached,
    productController.getAllProductsAdmin
);

router.get(
    '/get-product-admin/:id',
    vendorDetection,
    ensureVendorDataCached,
    validate(idParamSchema, 'params'),
    productController.getProductByIdAdmin
);

router.get(
    '/get-products',
    vendorDetection,
    ensureVendorDataCached,
    productController.getAllProductsClient
);

router.get(
    '/get-product/:id',
    vendorDetection,
    ensureVendorDataCached,
    validate(idParamSchema, 'params'),
    productController.getProductByIdClient
);

module.exports = router;