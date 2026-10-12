const abandonedCartService = require('../services/abandonedCartService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

// fetchAbandonedCartsForAdmin returns a bespoke shape (not a raw mongoose
// doc) grouping one or more Cart documents by owner - encode every id it
// carries: the primary cart's own _id, any other linked cart ids folded
// into the same group, and the owning user's id.
const formatAbandonedCartGroupForResponse = (group) => ({
    ...group,
    _id: group._id ? common.encodeId(group._id) : group._id,
    linkedCartIds: Array.isArray(group.linkedCartIds) ? group.linkedCartIds.map((id) => common.encodeId(id)) : group.linkedCartIds,
    userId: group.userId ? common.encodeId(group.userId) : group.userId,
    // Encoded the way Place Order's own product picker encodes them, so the
    // admin's Place Order page can take these lines over as they are.
    items: Array.isArray(group.items)
        ? group.items.map((item) => ({
            ...item,
            productId: common.encodeId(item.productId),
            variantId: common.encodeId(item.variantId),
            sizeId: common.encodeId(item.sizeId),
        }))
        : group.items,
});

/**
 * Both websiteMaster (global) and companyMaster (vendor-specific) must have
 * isAbondonedCartFeatureOn === true for the admin to view abandoned carts.
 * req.websiteMasterData / req.companyMasterData are populated upstream by
 * the ensureVendorDataCached middleware.
 *
 * Returns null if the feature is enabled, or an { statusCode, message } object if blocked.
 */
const getAbandonedCartFeatureBlockReason = async (req) => {
  const websiteMasterData = req.websiteMasterData;
  const companyMasterData = req.companyMasterData;

  const isAbandonedCartFeatureOn = await common.checkFeatureOnOrOff(
    req.vendorId, websiteMasterData, companyMasterData, 'isAbondonedCartFeatureOn', 'isAbondonedCartFeatureOn'
  );

  if (!isAbandonedCartFeatureOn.isSuccess) {
    return {
      statusCode: 403,
      message: isAbandonedCartFeatureOn.message || 'This feature is temporarily unavailable'
    };
  }

  return null;
};

const getAllAbandonedCartsAdmin = async (req, res) => {
  const vendorId = req.vendorId;
  try {
    const blockReason = await getAbandonedCartFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const result = await abandonedCartService.fetchAbandonedCartsForAdmin(vendorId, req.companySettingsData);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.data.map(formatAbandonedCartGroupForResponse));
  } catch (error) {
    logger.logException('abandonedCartController: getAllAbandonedCartsAdmin - Exception while fetching abandoned carts', { vendorId, error });
  }
};

// Places the order for one customer's abandoned cart straight from the list.
const placeOrderFromAbandonedCart = async (req, res) => {
  const vendorId = req.vendorId;
  let id;
  try {
    const blockReason = await getAbandonedCartFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    id = common.decodeId(req.params.id);
    // Exactly one of the two is sent (see placeOrderFromAbandonedCartSchema).
    const address = req.body.addressId
      ? { addressId: common.decodeId(req.body.addressId) }
      : { addressText: req.body.addressText };
    const result = await abandonedCartService.placeOrderFromAbandonedCart(
      vendorId, req.user._id, id, req.websiteMasterData, req.companyMasterData, req.companySettingsData, address
    );

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    const order = result.meta.order;
    return common.sendSuccess(res, result.statusCode, result.message, { _id: common.encodeId(order._id), orderNumber: order.orderNumber });
  } catch (error) {
    logger.logException('abandonedCartController: placeOrderFromAbandonedCart - Exception while placing an order from an abandoned cart', { vendorId, id, error });
  }
};

module.exports = {
  getAllAbandonedCartsAdmin,
  placeOrderFromAbandonedCart
};
