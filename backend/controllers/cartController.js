const cartService = require('../services/cartService');
const shippingEstimateService = require('../services/shippingEstimateService');
const logger = require('../utils/logger.js');
const common = require('../utils/common');

// Cart responses come in many different ad-hoc shapes (the cart document
// itself, plus loose objects like eligibleLineItems/droppedDiscounts/
// eligible-free-cash rows that checkoutCart/applyDiscounts/applyFreeCash/
// getEligibleFreeCash build by hand) - rather than hand-writing a separate
// formatter per shape, this walks any response value and encodes every key
// whose NAME is a known id field, wherever it appears. Same common.encodeId
// used everywhere else in this rollout, just applied generically by key name
// instead of by a fixed per-model field list.
const ID_FIELD_NAMES = new Set([
    '_id', 'vendorId', 'userId', 'possibleUserId', 'createdBy', 'updatedBy',
    'deletedBy', 'activeMarkedBy', 'inActiveMarkedBy', 'inActiveMarkeddBy',
    'productId', 'variantId', 'sizeId', 'discountId', 'freeCashId',
    'userFreeCashId', 'taxId'
]);
const ID_ARRAY_FIELD_NAMES = new Set(['taxIds', 'discountIds', 'freeCashIds']);

const deepEncodeIds = (value) => {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return value;
    if (Array.isArray(value)) return value.map(deepEncodeIds);
    if (typeof value === 'object') {
        if (typeof value.toObject === 'function') value = value.toObject();
        const out = {};
        for (const [key, val] of Object.entries(value)) {
            if (val !== null && val !== undefined && ID_FIELD_NAMES.has(key)) {
                out[key] = common.encodeId(val);
            } else if (Array.isArray(val) && ID_ARRAY_FIELD_NAMES.has(key)) {
                out[key] = val.map((v) => (v !== null && v !== undefined ? common.encodeId(v) : v));
            } else {
                out[key] = deepEncodeIds(val);
            }
        }
        return out;
    }
    return value;
};

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
        const payload = {
            ...req.body,
            productId: common.decodeId(req.body.productId),
            variantId: common.decodeId(req.body.variantId),
            sizeId: common.decodeId(req.body.sizeId)
        };
        const result = await cartService.addProductToCart(
            vendorId,
            req.cartOwner,
            locationContext,
            req.companyMasterData,
            req.websiteMasterData,
            req.companySettingsData,
            payload,
            req.possibleUserId || null
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta));
    } catch (error) {
        logger.logException('Error adding product to cart', { vendorId, error });
        return common.sendError(res, 500, 'Failed to add product to cart');
    }
};

const updateCartItem = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const payload = {
            ...req.body,
            productId: common.decodeId(req.body.productId),
            variantId: common.decodeId(req.body.variantId),
            sizeId: common.decodeId(req.body.sizeId)
        };
        const result = await cartService.updateCartItemQuantity(vendorId, req.cartOwner, req.companyMasterData, req.websiteMasterData, req.companySettingsData, payload);
        if (!result.isSuccess) {
            // Over stock: tell the storefront how many are left so it can use that instead.
            const stockError = result.meta?.availableStock !== undefined
                ? [{ field: 'quantity', message: result.message, availableStock: result.meta.availableStock }]
                : null;
            return common.sendError(res, result.statusCode, result.message, stockError);
        }
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta));
    } catch (error) {
        logger.logException('Error updating cart item', { vendorId, error });
        return common.sendError(res, 500, 'Failed to update cart item');
    }
};

const removeCartItem = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const payload = {
            ...req.body,
            productId: common.decodeId(req.body.productId),
            variantId: common.decodeId(req.body.variantId),
            sizeId: common.decodeId(req.body.sizeId)
        };
        const result = await cartService.removeCartItem(vendorId, req.cartOwner, payload);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta));
    } catch (error) {
        logger.logException('Error removing cart item', { vendorId, error });
        return common.sendError(res, 500, 'Failed to remove cart item');
    }
};

const getCart = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const locationContext = buildLocationContext(req);
        const result = await cartService.getCart(vendorId, req.cartOwner, locationContext, req.companyMasterData, req.websiteMasterData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta));
    } catch (error) {
        logger.logException('Error fetching cart', { vendorId, error });
        return common.sendError(res, 500, 'Failed to fetch cart');
    }
};

const applyDiscounts = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user ? req.user._id : null;
        const payload = {
            ...req.body,
            discountIds: (req.body.discountIds || []).map((id) => common.decodeId(id))
        };
        const result = await cartService.applyDiscountsToCart(vendorId, req.cartOwner, userId, req.companyMasterData, req.websiteMasterData, payload);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta));
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
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta));
    } catch (error) {
        logger.logException('Error removing discounts from cart', { vendorId, error });
        return common.sendError(res, 500, 'Failed to remove discounts');
    }
};

const applyFreeCash = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user ? req.user._id : null;
        const payload = {
            ...req.body,
            freeCashIds: (req.body.freeCashIds || []).map((id) => common.decodeId(id))
        };
        const result = await cartService.applyFreeCashToCart(
            vendorId, req.cartOwner, userId, req.companyMasterData, req.websiteMasterData, req.companySettingsData, payload
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message, deepEncodeIds(result.meta));
        }
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta));
    } catch (error) {
        logger.logException('cartController: applyFreeCash - Exception while applying Free Cash to cart', { vendorId, error });
    }
};

const removeFreeCash = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user ? req.user._id : null;
        const result = await cartService.removeFreeCashFromCart(vendorId, req.cartOwner, userId);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta));
    } catch (error) {
        logger.logException('cartController: removeFreeCash - Exception while removing Free Cash from cart', { vendorId, error });
    }
};

const getEligibleFreeCash = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const userId = req.user ? req.user._id : null;
        const result = await cartService.listEligibleFreeCashForCart(
            vendorId, req.cartOwner, userId, req.companyMasterData, req.websiteMasterData, req.companySettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta.data));
    } catch (error) {
        logger.logException('cartController: getEligibleFreeCash - Exception while fetching eligible Free Cash', { vendorId, error });
    }
};

const getShippingEstimate = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        // Only the browsing-location cookies here - for a logged-in user the
        // service resolves the chosen/default saved address itself.
        const cookieLocation = {
            countryId: req.cookies?.Country || null,
            stateId: req.cookies?.State || null,
            cityId: req.cookies?.City || null,
            zipCode: req.cookies?.zip_code || null
        };
        const result = await shippingEstimateService.getShippingEstimate({
            vendorId,
            cartOwner: req.cartOwner,
            userId: req.user ? req.user._id : null,
            addressId: req.query.addressId ? common.decodeId(req.query.addressId) : null,
            cookieLocation,
            companyMasterData: req.companyMasterData,
            websiteMasterData: req.websiteMasterData,
            shippingPriceSettingsData: req.shippingPriceSettingsData
        });
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta));
    } catch (error) {
        logger.logException('cartController: getShippingEstimate - Exception while estimating shipping', { vendorId, error });
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
            req.companySettingsData,
            req.shippingPriceSettingsData
        );
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta));
    } catch (error) {
        logger.logException('Error checking out cart', { vendorId, error });
        return common.sendError(res, 500, 'Failed to checkout cart');
    }
};

const getTaxEstimate = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        // Same location sources as getShippingEstimate above.
        const cookieLocation = {
            countryId: req.cookies?.Country || null,
            stateId: req.cookies?.State || null,
            cityId: req.cookies?.City || null,
            zipCode: req.cookies?.zip_code || null
        };
        const result = await shippingEstimateService.getTaxEstimate({
            vendorId,
            cartOwner: req.cartOwner,
            userId: req.user ? req.user._id : null,
            addressId: req.query.addressId ? common.decodeId(req.query.addressId) : null,
            cookieLocation,
            companySettingsData: req.companySettingsData
        });
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, deepEncodeIds(result.meta));
    } catch (error) {
        logger.logException('cartController: getTaxEstimate - Exception while estimating tax', { vendorId, error });
    }
};

module.exports = {
    getShippingEstimate,
    getTaxEstimate,
    addToCart,
    updateCartItem,
    removeCartItem,
    getCart,
    applyDiscounts,
    removeDiscounts,
    applyFreeCash,
    removeFreeCash,
    getEligibleFreeCash,
    checkoutCart
};
