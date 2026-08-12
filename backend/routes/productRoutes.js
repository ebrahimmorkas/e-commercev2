const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController');
const validate = require('../middlewares/validate');
const {
  createProductSchema,
  updateProductSchema,
  productIdParamSchema,
  listQuerySchema
} = require('../middlewares/validations/productValidations');

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');

// ---------------------------------------------------------------------------
// Client-facing (public storefront) routes - status 'A' only, no auth
// middleware at all. Browsing must stay open to guests. When a request DOES
// carry a valid Bearer token, getAllProductsClient / getProductById resolve
// it themselves (via token.resolveUserFromAuthHeader) so location-based
// filtering can run for logged-in customers - see productController.js.
// vendorDetection + ensureVendorDataCached still run because the response
// needs vendorId scoping and companyMaster/websiteMaster for feature-gated
// display decisions on the frontend.
// ---------------------------------------------------------------------------
router.get(
  '/get-all',
  vendorDetection,
  ensureVendorDataCached,
  validate(listQuerySchema, 'query'),
  productController.getAllProductsClient
);

router.get(
  '/get-product/:productId',
  vendorDetection,
  ensureVendorDataCached,
  validate(productIdParamSchema, 'params'),
  productController.getProductById
);

// ---------------------------------------------------------------------------
// Admin (vendor back-office) routes - status 'I' + 'A', requires login.
// Order matters: vendorDetection must run before ensureVendorDataCached
// (needs req.vendorId), and before authorize (role check doesn't need
// vendor context, but keeping vendor resolution first fails fast on a bad
// domain before bothering with token checks).
// ---------------------------------------------------------------------------
router.get(
  '/admin-get-all',
  vendorDetection,
  ensureVendorDataCached,
  validate(listQuerySchema, 'query'),
  productController.getAllProductsAdmin
);

router.get(
  '/admin/products/:productId',
  vendorDetection,
  authenticate,
  authorize('admin'),
  ensureVendorDataCached,
  validate(productIdParamSchema, 'params'),
  productController.getProductById
);

router.post(
  '/add-product',
  vendorDetection,
  ensureVendorDataCached,
  validate(createProductSchema, 'body'),
  productController.createProduct
);

router.put(
  '/admin/products/:productId',
  vendorDetection,
  authenticate,
  authorize('admin'),
  ensureVendorDataCached,
  validate(productIdParamSchema, 'params'),
  validate(updateProductSchema, 'body'),
  productController.updateProduct
);

router.delete(
  '/admin/products/:productId',
  vendorDetection,
  authenticate,
  authorize('admin'),
  ensureVendorDataCached,
  validate(productIdParamSchema, 'params'),
  productController.deleteProduct
);

module.exports = router;