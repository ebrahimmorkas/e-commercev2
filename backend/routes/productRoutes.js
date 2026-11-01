const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const productVideoController = require('../controllers/productVideoController');
const productVideoUpload = require('../middlewares/productVideoUpload');
const { uploadProductVideoSchema, productVideoIdParamSchema } = require('../middlewares/validations/productVideoValidations');
const validate = require('../middlewares/validate');
const { createProductSchema, updateProductSchema, toggleProductStatusSchema, deleteProductSchema, cloneProductSchema, bulkCloneProductSchema, bulkProductStatusSchema, bulkDeleteProductSchema, idParamSchema, productListQuerySchema, adminProductListQuerySchema, productExportQuerySchema, brandIdParamSchema, categoryIdParamSchema } = require('../middlewares/validations/productValidations');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const imageUpload = require('../middlewares/imageUpload');
const createBulkUploader = require('../middlewares/multer/bulkFileUpload');
// videosZip is written to disk (videos are too big for memory); its ceiling is
// WebsiteMaster.bulkUploadVideoZipMaxSizeMB, read per request.
const productBulkUpload = createBulkUploader({
    zipFieldNames: ['mainImagesZip', 'additionalImagesZip'],
    diskZipFieldNames: ['videosZip'],
    resolveDiskZipMaxSizeMB: (req) => {
        try {
            return req.websiteMasterData?.bulkUploadVideoZipMaxSizeMB ?? 1024;
        } catch (err) {
            throw err;
        }
    }
});
const common = require('../utils/common');

// Every route that reads or changes the admin catalogue: a logged-in admin of
// THIS store (authenticate also rejects a token from another store). The
// storefront read routes further down (get-products, get-product/:id,
// by-brand, by-category) stay public. Kept before vendorDetection /
// ensureVendorDataCached so unauthenticated requests are rejected before any
// vendor data is loaded.
const adminAccess = [authenticate, authorize('admin'), vendorDetection, ensureVendorDataCached];

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

router.post( '/add-product', ...adminAccess, checkModuleAssigned('PRODUCTS'), imageUpload.any(), parseProductData, validate(createProductSchema, 'body'), productController.createProduct );

// Product videos (admin form): the switch + limits, one upload per video
// (before the product is saved - the save then lists the returned ids per
// size), and removing an upload the form never saved.
router.get( '/product-video-settings', ...adminAccess, checkModuleAssigned('PRODUCTS'), productVideoController.getProductVideoSettings );

router.post( '/upload-product-video', ...adminAccess, checkModuleAssigned('PRODUCTS'), productVideoUpload, validate(uploadProductVideoSchema, 'body'), productVideoController.uploadProductVideo );

router.delete( '/product-video/:videoId', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(productVideoIdParamSchema, 'params'), productVideoController.discardProductVideo );

router.get( '/get-products-admin', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(adminProductListQuerySchema, 'query'), productController.getAllProductsAdmin );

// Lightweight, server-searched { _id, name, productCode, status } rows for admin product pickers.
router.get( '/get-product-options-admin', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(productListQuerySchema, 'query'), productController.getProductOptionsAdmin );

router.get( '/get-product-admin/:id', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(idParamSchema, 'params'), productController.getProductByIdAdmin );

router.get( '/get-products', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(productListQuerySchema, 'query'), productController.getAllProductsClient );

router.get( '/get-product/:id', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(idParamSchema, 'params'), productController.getProductByIdClient );

router.get( '/get-products-by-brand/:brandId', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(brandIdParamSchema, 'params'), validate(productListQuerySchema, 'query'), productController.getProductsByBrand );

router.get( '/get-products-by-category/:categoryId', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(categoryIdParamSchema, 'params'), validate(productListQuerySchema, 'query'), productController.getProductsByCategory );

router.get( '/get-products-by-category-admin/:categoryId', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(categoryIdParamSchema, 'params'), productController.getProductsByCategoryAdmin );

// Sample workbooks for the two excel uploads below (no input, so nothing to validate).
router.get( '/bulk-upload-products/sample-file', ...adminAccess, checkModuleAssigned('PRODUCTS'), productController.downloadBulkUploadSampleFile );

router.get( '/bulk-update-products/sample-file', ...adminAccess, checkModuleAssigned('BULK_UPDATE_PRODUCTS'), productController.downloadBulkUpdateSampleFile );

// Products page > Download: a zip of the products (Bulk Update excel format) + their images.
router.get( '/export-products', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(productExportQuerySchema, 'query'), productController.exportProducts );

router.post( '/bulk-upload-products', ...adminAccess, checkModuleAssigned('PRODUCTS'), productBulkUpload, productController.bulkUploadProducts );

router.post( '/bulk-update-products', ...adminAccess, checkModuleAssigned('BULK_UPDATE_PRODUCTS'), productBulkUpload, productController.bulkUpdateProducts );

router.put( '/update-product', ...adminAccess, checkModuleAssigned('PRODUCTS'), imageUpload.any(), parseProductData, validate(updateProductSchema, 'body'), productController.updateProduct );

router.patch( '/toggle-product-status', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(toggleProductStatusSchema, 'body'), productController.toggleProductStatus );

router.delete( '/delete-product', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(deleteProductSchema, 'body'), productController.deleteProduct );

router.post( '/clone-product', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(cloneProductSchema, 'body'), productController.cloneProduct );

router.post( '/bulk-clone-products', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(bulkCloneProductSchema, 'body'), productController.bulkCloneProducts );

// Bulk multi-select actions (frontend checkbox selection).
router.patch( '/bulk-status', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(bulkProductStatusSchema, 'body'), productController.bulkSetProductStatus );

router.delete( '/bulk-delete', ...adminAccess, checkModuleAssigned('PRODUCTS'), validate(bulkDeleteProductSchema, 'body'), productController.bulkDeleteProducts );

module.exports = router;