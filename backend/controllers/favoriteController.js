const favoriteService = require('../services/favoriteService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

const addToFavorites = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;
    const { productId, variantId, sizeId } = req.body;

    const result = await favoriteService.addToFavorites(
      vendorId,
      userId,
      req.websiteMasterData,
      req.companyMasterData,
      productId,
      variantId,
      sizeId
    );

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error adding item to favorites', { error });
  }
};

const removeFromFavorites = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;
    const { productId, variantId, sizeId } = req.body;

    const result = await favoriteService.removeFromFavorites(vendorId, userId, productId, variantId, sizeId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message);
  } catch (error) {
    logger.logException('Error removing item from favorites', { error });
  }
};

const getFavorites = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await favoriteService.getFavorites(vendorId, userId, page, limit);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching favorites', { error });
  }
};

// Same location-context shape as cartController.js's buildLocationContext /
// orderController.js's createOrder - order creation is login-only, so this
// always reads off req.user rather than cookies.
const buildLocationContext = (req) => ({
  countryId: req.user.country || null,
  stateId: req.user.state || null,
  cityId: req.user.city || null,
  zipCode: null
});

const createOrderFromFavorites = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;
    const { items, shippingAddressId, billingAddressId, orderNumber } = req.body;
    const locationContext = buildLocationContext(req);

    const result = await favoriteService.createOrderFromFavorites(
      vendorId,
      userId,
      req.user.country || null,
      locationContext,
      req.companyMasterData,
      req.websiteMasterData,
      req.companySettingsData,
      items,
      { shippingAddressId, billingAddressId, orderNumber }
    );

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error creating order from favorites', { error });
  }
};

module.exports = {
  addToFavorites,
  removeFromFavorites,
  getFavorites,
  createOrderFromFavorites
};
