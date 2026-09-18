const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const validate = require('../middlewares/validate');
const { createProductSchema, updateProductSchema, toggleProductStatusSchema, deleteProductSchema, cloneProductSchema, bulkCloneProductSchema, bulkProductStatusSchema, bulkDeleteProductSchema, idParamSchema, brandIdParamSchema, categoryIdParamSchema } = require('../middlewares/validations/productValidations');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
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

router.post( '/add-product', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), imageUpload.any(), parseProductData, validate(createProductSchema, 'body'), productController.createProduct );

router.get( '/get-products-admin', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), productController.getAllProductsAdmin );

router.get( '/get-product-admin/:id', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(idParamSchema, 'params'), productController.getProductByIdAdmin );

router.get( '/get-products', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), productController.getAllProductsClient );

router.get( '/get-product/:id', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(idParamSchema, 'params'), productController.getProductByIdClient );

router.get( '/get-products-by-brand/:brandId', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(brandIdParamSchema, 'params'), productController.getProductsByBrand );

router.get( '/get-products-by-category/:categoryId', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(categoryIdParamSchema, 'params'), productController.getProductsByCategory );

router.get( '/get-products-by-category-admin/:categoryId', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(categoryIdParamSchema, 'params'), productController.getProductsByCategoryAdmin );

router.post( '/bulk-upload-products', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), productBulkUpload, productController.bulkUploadProducts );

router.post( '/bulk-update-products', vendorDetection, ensureVendorDataCached, checkModuleAssigned('BULK_UPDATE_PRODUCTS'), productBulkUpload, productController.bulkUpdateProducts );

router.put( '/update-product', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), imageUpload.any(), parseProductData, validate(updateProductSchema, 'body'), productController.updateProduct );

router.patch( '/toggle-product-status', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(toggleProductStatusSchema, 'body'), productController.toggleProductStatus );

router.delete( '/delete-product', vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(deleteProductSchema, 'body'), productController.deleteProduct );

// Clone routes are the only ones on this router with authenticate/authorize
// wired in (real req.user._id for createdBy attribution) - the rest of this
// file still uses the createProduct-era placeholder userId until that's
// addressed separately.
router.post( '/clone-product', authenticate, authorize('admin', 'user'), vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(cloneProductSchema, 'body'), productController.cloneProduct );

router.post( '/bulk-clone-products', authenticate, authorize('admin', 'user'), vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(bulkCloneProductSchema, 'body'), productController.bulkCloneProducts );

// Bulk multi-select actions (frontend checkbox selection) - admin-only,
// same real-auth situation as the clone routes above.
router.patch( '/bulk-status', authenticate, authorize('admin'), vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(bulkProductStatusSchema, 'body'), productController.bulkSetProductStatus );

router.delete( '/bulk-delete', authenticate, authorize('admin'), vendorDetection, ensureVendorDataCached, checkModuleAssigned('PRODUCTS'), validate(bulkDeleteProductSchema, 'body'), productController.bulkDeleteProducts );

module.exports = router;