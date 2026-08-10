const express = require('express');
const router = express.Router();

const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const vendorDetection = require('../middlewares/vendorDetection');
const productController = require('../controllers/productController');

// -----------------------------------------------------------------------
// Storefront (public) routes — vendorDetection resolves the vendor from
// the request domain, no authentication required.
// -----------------------------------------------------------------------

router.get('/products', productController.listStorefrontProducts);
router.get('/products/:slug', productController.getStorefrontProductBySlug);

// -----------------------------------------------------------------------
// Vendor-admin routes — authenticate + authorize only.
// productId is read from req.body (not the URL) per requirement.
// NOTE: 'vendor' and 'admin' are placeholder role strings — adjust to
// match whatever role values actually exist on your User model.
// -----------------------------------------------------------------------

router.post('/', authenticate, authorize('admin'), productController.createProduct);
router.get('/', authenticate, authorize('admin'), productController.listProducts);
// Using POST here rather than GET, since GET requests can't reliably
// carry a body through every client/proxy — the browser fetch API and
// axios support it, but not everything does.
router.post('/details', authenticate, authorize('admin'), productController.getProductById);
router.put('/', authenticate, authorize('admin'), productController.updateProduct);
router.delete('/', authenticate, authorize('admin'), productController.deleteProduct);

module.exports = router;