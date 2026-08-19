const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const validate = require('../middlewares/validate');
const { createProductSchema, updateProductSchema, toggleProductStatusSchema, deleteProductSchema, idParamSchema } = require('../middlewares/validations/productValidations');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const imageUpload = require('../middlewares/imageUpload');
const createBulkUploader = require('../middlewares/multer/bulkFileUpload');
const productBulkUpload = createBulkUploader({ zipFieldNames: ['mainImagesZip', 'additionalImagesZip'] });
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

router.post( '/add-product', vendorDetection, ensureVendorDataCached, imageUpload.any(), parseProductData, validate(createProductSchema, 'body'), productController.createProduct );

router.get( '/get-products-admin', vendorDetection, ensureVendorDataCached, productController.getAllProductsAdmin );

router.get( '/get-product-admin/:id', vendorDetection, ensureVendorDataCached, validate(idParamSchema, 'params'), productController.getProductByIdAdmin );

router.get( '/get-products', vendorDetection, ensureVendorDataCached, productController.getAllProductsClient );

router.get( '/get-product/:id', vendorDetection, ensureVendorDataCached, validate(idParamSchema, 'params'), productController.getProductByIdClient );

router.post( '/bulk-upload-products', vendorDetection, ensureVendorDataCached, productBulkUpload, productController.bulkUploadProducts );

router.put( '/update-product', vendorDetection, ensureVendorDataCached, imageUpload.any(), parseProductData, validate(updateProductSchema, 'body'), productController.updateProduct );

router.patch( '/toggle-product-status', vendorDetection, ensureVendorDataCached, validate(toggleProductStatusSchema, 'body'), productController.toggleProductStatus );

router.delete( '/delete-product', vendorDetection, ensureVendorDataCached, validate(deleteProductSchema, 'body'), productController.deleteProduct );

module.exports = router;