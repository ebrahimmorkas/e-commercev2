const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const validate = require('../middlewares/validate');
const { addToCartSchema, updateCartItemSchema, removeCartItemSchema, applyDiscountsSchema } = require('../middlewares/validations/cartValidations');
const vendorDetection = require('../middlewares/vendorDetection');
const ensureVendorDataCached = require('../middlewares/ensureVendorDataCached');
const authenticate = require('../middlewares/authenticate');
const resolveCartOwner = require('../middlewares/resolveCartOwner');
// Every cart route is reachable by BOTH guests and logged-in users, so
// optionalAuthenticate (never rejects) + resolveCartOwner (guest cookie or
// req.user) replace the usual authenticate + authorize('user') pairing.
// checkoutCart itself still enforces "must be logged in" inside the
// service, since only a logged-in user's cart can be checked out.
const cartAccess = [vendorDetection, ensureVendorDataCached, resolveCartOwner];

router.get('/get-cart', ...cartAccess, cartController.getCart);

router.post('/add-to-cart', ...cartAccess, validate(addToCartSchema, 'body'), cartController.addToCart);

router.put('/update-cart', ...cartAccess, validate(updateCartItemSchema, 'body'), cartController.updateCartItem);

router.delete('/remove-cart-item', ...cartAccess, validate(removeCartItemSchema, 'body'), cartController.removeCartItem);

router.post('/apply-discounts', ...cartAccess, validate(applyDiscountsSchema, 'body'), cartController.applyDiscounts);

router.delete('/remove-discounts', ...cartAccess, cartController.removeDiscounts);

router.post('/checkout-cart', ...cartAccess, cartController.checkoutCart);

module.exports = router;
