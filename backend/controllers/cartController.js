const cartService = require('../services/cartService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// Same cookie names/shape as productController.js's readLocationCookies,
// extended to also cover the logged-in case. For a logged-in user we reuse
// req.user.country/state/state/city (copied onto req.user by
// authenticate.js/optionalAuthenticate.js from the User document) instead
// of cookies - a logged-in user's account location always wins over
// whatever stale location cookies might still be sitting in their browser.
const buildLocationContext = (req) => {
    if (req.user) {
        return {
            countryId: req.user.country || null,
            stateId: req.user.state || null,
            cityId: req.user.city || null,
            zipCode: null
        };
    }
    return {
        countryId: req.cookies?.Country || null,
        stateId: req.cookies?.State || null,
        cityId: req.cookies?.City || null,
        zipCode: req.cookies?.zip_code || null
    };
};

const addToCart = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const locationContext = buildLocationContext(req);
        const result = await cartService.addProductToCart(
            vendorId,
            req.cartOwner,
            locationContext,
            req.companyMasterData,
            req.websiteMasterData,
            req.companySettingsData,
            req.body
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error adding product to cart', { vendorId, error });
        return common.sendError(res, 500, 'Failed to add product to cart');
    }
};

const updateCartItem = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await cartService.updateCartItemQuantity(vendorId, req.cartOwner, req.companySettingsData, req.body);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error updating cart item', { vendorId, error });
        return common.sendError(res, 500, 'Failed to update cart item');
    }
};

const removeCartItem = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await cartService.removeCartItem(vendorId, req.cartOwner, req.body);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error removing cart item', { vendorId, error });
        return common.sendError(res, 500, 'Failed to remove cart item');
    }
};

const getCart = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const locationContext = buildLocationContext(req);
        const result = await cartService.getCart(vendorId, req.cartOwner, locationContext);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error fetching cart', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch cart');
    }
};

const applyDiscounts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user ? req.user._id : null;
        const result = await cartService.applyDiscountsToCart(vendorId, req.cartOwner, userId, req.companyMasterData, req.websiteMasterData, req.body);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error applying discounts to cart', { vendorId, error });
        return common.sendError(res, 500, 'Failed to apply discounts');
    }
};

const removeDiscounts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await cartService.removeDiscountsFromCart(vendorId, req.cartOwner);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error removing discounts from cart', { vendorId, error });
        return common.sendError(res, 500, 'Failed to remove discounts');
    }
};

const checkoutCart = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user ? req.user._id : null;
        const locationContext = buildLocationContext(req);
        const result = await cartService.checkoutCart(
            vendorId,
            req.cartOwner,
            userId,
            locationContext,
            req.companyMasterData,
            req.websiteMasterData,
            req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('Error checking out cart', { vendorId, error });
        return common.sendError(res, 500, 'Failed to checkout cart');
    }
};

module.exports = {
    addToCart,
    updateCartItem,
    removeCartItem,
    getCart,
    applyDiscounts,
    removeDiscounts,
    checkoutCart
};
