const favoriteService = require('../services/favoriteService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

// favoriteService.buildFavoriteResponse returns a flattened join object
// (favoriteId/productId/variantId/sizeId - not the raw Favorite doc, no
// vendorId/audit fields present), so this only needs to encode those four.
const formatFavoriteEntry = (entry) => {
  if (!entry) return entry;
  return {
    ...entry,
    favoriteId: entry.favoriteId ? common.encodeId(entry.favoriteId) : entry.favoriteId,
    productId: entry.productId ? common.encodeId(entry.productId) : entry.productId,
    variantId: entry.variantId ? common.encodeId(entry.variantId) : entry.variantId,
    sizeId: entry.sizeId ? common.encodeId(entry.sizeId) : entry.sizeId,
  };
};

// createOrderFromFavorites ultimately returns whatever orderService.
// createOrderFromCart returns ({ order, ineligibleItems }) - encode the
// same Order fields the Orders module's own formatter does (same
// common.encodeId/decodeId functions either side, so the two stay
// consistent even though they're implemented in separate files).
const formatOrderForResponse = (orderDoc) => {
  if (!orderDoc) return orderDoc;
  const order = orderDoc.toObject ? orderDoc.toObject() : orderDoc;
  const encodeIfPresent = (id) => (id ? common.encodeId(id) : id);

  return {
    ...order,
    _id: encodeIfPresent(order._id),
    cartId: encodeIfPresent(order.cartId),
    vendorId: encodeIfPresent(order.vendorId),
    userId: encodeIfPresent(order.userId),
    orderStepMasterId: encodeIfPresent(order.orderStepMasterId),
    currentStepId: encodeIfPresent(order.currentStepId),
    currencyId: encodeIfPresent(order.currencyId),
    shippingAddressId: encodeIfPresent(order.shippingAddressId),
    billingAddressId: encodeIfPresent(order.billingAddressId),
    placedByAdminId: encodeIfPresent(order.placedByAdminId),
    assignedDeliveryAgentId: encodeIfPresent(order.assignedDeliveryAgentId),
    cancelledBy: encodeIfPresent(order.cancelledBy),
    createdBy: encodeIfPresent(order.createdBy),
    updatedBy: encodeIfPresent(order.updatedBy),
    deletedBy: encodeIfPresent(order.deletedBy),
    activeMarkedBy: encodeIfPresent(order.activeMarkedBy),
    inActiveMarkedBy: encodeIfPresent(order.inActiveMarkedBy),
    statusHistory: Array.isArray(order.statusHistory)
      ? order.statusHistory.map((h) => ({ ...h, stepId: encodeIfPresent(h.stepId), changedBy: encodeIfPresent(h.changedBy) }))
      : order.statusHistory,
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          ...item,
          productId: encodeIfPresent(item.productId),
          variantId: encodeIfPresent(item.variantId),
          sizeId: encodeIfPresent(item.sizeId),
          taxBreakdown: Array.isArray(item.taxBreakdown)
            ? item.taxBreakdown.map((t) => ({ ...t, taxId: encodeIfPresent(t.taxId) }))
            : item.taxBreakdown,
        }))
      : order.items,
  };
};

const addToFavorites = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;
    const productId = common.decodeId(req.body.productId);
    const variantId = common.decodeId(req.body.variantId);
    const sizeId = common.decodeId(req.body.sizeId);

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
    return common.sendSuccess(res, result.statusCode, result.message, {
      ...result.meta,
      favorite: formatFavoriteEntry(result.meta.favorite)
    });
  } catch (error) {
    logger.logException('Error adding item to favorites', { error });
  }
};

const removeFromFavorites = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;
    const productId = common.decodeId(req.body.productId);
    const variantId = common.decodeId(req.body.variantId);
    const sizeId = common.decodeId(req.body.sizeId);

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
    return common.sendSuccess(res, result.statusCode, result.message, {
      ...result.meta,
      favorites: result.meta.favorites.map(formatFavoriteEntry)
    });
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
    const decodedItems = (items || []).map((item) => ({
      ...item,
      favoriteId: common.decodeId(item.favoriteId)
    }));
    const locationContext = buildLocationContext(req);

    const result = await favoriteService.createOrderFromFavorites(
      vendorId,
      userId,
      // Same country the storefront showed prices for (currencyController).
      req.cookies?.Country || req.user.country || null,
      locationContext,
      req.companyMasterData,
      req.websiteMasterData,
      req.companySettingsData,
      req.shippingPriceSettingsData,
      decodedItems,
      {
        shippingAddressId: shippingAddressId ? common.decodeId(shippingAddressId) : shippingAddressId,
        billingAddressId: billingAddressId ? common.decodeId(billingAddressId) : billingAddressId,
        orderNumber
      }
    );

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, {
      ...result.meta,
      order: formatOrderForResponse(result.meta.order)
    });
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
