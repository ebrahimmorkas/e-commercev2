const discountService = require('../services/discountService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

// Converts a Discount mongoose doc (or plain object) into a response-safe
// object with every ObjectId field encoded via common.encodeId. `productIds`/
// `categoryIds`/`userIds` are resolved server-side from an uploaded excel
// file (see resolveGiveDiscountToTargets in discountService.js) and never
// arrive from the client as ids, but they're still real ids once stored, so
// they're encoded on the way out same as everything else. `variantIds`
// (PRODUCT_VARIANTS_* giveDiscountTo options) isn't wired up yet
// (discountService.js returns "not supported yet" for it) but is included
// here too, for whenever it lands.
const encodeIdArray = (ids) => (Array.isArray(ids) ? ids.map((id) => common.encodeId(id)) : ids);

const formatDiscountForResponse = (discountDoc) => {
  if (!discountDoc) return discountDoc;
  const discount = discountDoc.toObject ? discountDoc.toObject() : discountDoc;

  return {
    ...discount,
    _id: discount._id ? common.encodeId(discount._id) : discount._id,
    vendorId: discount.vendorId ? common.encodeId(discount.vendorId) : discount.vendorId,
    userIds: encodeIdArray(discount.userIds),
    userGroupIds: encodeIdArray(discount.userGroupIds),
    productIds: encodeIdArray(discount.productIds),
    productGroupIds: encodeIdArray(discount.productGroupIds),
    variantIds: encodeIdArray(discount.variantIds),
    categoryIds: encodeIdArray(discount.categoryIds),
    categoryGroupIds: encodeIdArray(discount.categoryGroupIds),
    createdBy: discount.createdBy ? common.encodeId(discount.createdBy) : discount.createdBy,
    updatedBy: discount.updatedBy ? common.encodeId(discount.updatedBy) : discount.updatedBy,
    deletedBy: discount.deletedBy ? common.encodeId(discount.deletedBy) : discount.deletedBy,
    inActiveMarkeddBy: discount.inActiveMarkeddBy ? common.encodeId(discount.inActiveMarkeddBy) : discount.inActiveMarkeddBy,
    activeMarkedBy: discount.activeMarkedBy ? common.encodeId(discount.activeMarkedBy) : discount.activeMarkedBy,
  };
};

// The only id-bearing fields that ever arrive directly from the client in a
// create/update discount payload - productIds/categoryIds/userIds are
// resolved server-side from an excel upload (see discountService.js), never
// submitted as ids by the client.
const decodeDiscountPayloadIds = (body) => {
  const payload = { ...body };
  ['productGroupIds', 'categoryGroupIds', 'userGroupIds'].forEach((field) => {
    if (Array.isArray(payload[field])) {
      payload[field] = payload[field].map((id) => common.decodeId(id));
    }
  });
  return payload;
};

/**
 * Both websiteMaster (global) and companyMaster (vendor-specific) must have
 * isDiscountFeatureOn === true for discount actions to be allowed.
 * req.websiteMasterData / req.companyMasterData are populated upstream by
 * the ensureVendorDataCached middleware.
 *
 * Returns null if the feature is enabled, or an { statusCode, message } object if blocked.
 */
const getDiscountFeatureBlockReason = async (req) => {
  const websiteMasterData = req.websiteMasterData;
  const companyMasterData = req.companyMasterData;

  // if (!websiteMasterData || websiteMasterData.isDiscountFeatureOn !== true) {
  //   return {
  //     statusCode: 403,
  //     message: (websiteMasterData && websiteMasterData.temporaryFeatureOffMessage)
  //       || 'This feature is temporarily unavailable. Please check back later.'
  //   };
  // }

  // if (!companyMasterData || companyMasterData.isDiscountFeatureOn !== true) {
  //   return {
  //     statusCode: 403,
  //     message: (websiteMasterData && websiteMasterData.featureDisabledForVendorMessage)
  //       || 'This feature is not enabled for your account. Please contact support.'
  //   };
  // }

  const isDiscountFeatureOn = await common.checkFeatureOnOrOff(req.vendorId, req.websiteMasterData, req.companyMasterData, `isDiscountFeatureOn`, `isDiscountFeatureOn`);
  if(!isDiscountFeatureOn.isSuccess) {
    return {
      statusCode: 403,
      message: isDiscountFeatureOn.message || `This feature is temporarily unavailable`
    };
  }

  return null;
};

const createDiscount = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user._id;
  try {
    const blockReason = await getDiscountFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const companyMasterData = req.companyMasterData;
    const monthlyLimit = companyMasterData ? companyMasterData.numberOfDiscountsPerMonth : null;

    if (monthlyLimit !== null && monthlyLimit !== undefined) {
      const countResult = await discountService.countDiscountsCreatedThisMonth(vendorId);
      if (!countResult.isSuccess) {
        return common.sendError(res, countResult.statusCode, countResult.message);
      }
      if (countResult.meta.count >= monthlyLimit) {
        return common.sendError(res, 403, `Monthly discount creation limit (${monthlyLimit}) has been reached.`);
      }
    }

        const files = req.files || {};
    const payload = decodeDiscountPayloadIds(req.body);
    const result = await discountService.createDiscount(vendorId, userId, payload, files, req.companyMasterData);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message, result.meta);
    }

        return common.sendSuccess(res, result.statusCode, result.message, {
          ...result.meta,
          data: formatDiscountForResponse(result.meta.data)
        });
  } catch (error) {
    logger.logException('Error creating discount', { vendorId, error });
  }
};

const updateDiscount = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user && req.user._id;
  let discountId;
    try {
    const blockReason = await getDiscountFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    discountId = common.decodeId(req.params.id);
    const files = req.files || {};
    const payload = decodeDiscountPayloadIds(req.body);
    const result = await discountService.updateDiscount(vendorId, discountId, userId, payload, files, req.companyMasterData);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message, result.meta);
    }

        return common.sendSuccess(res, result.statusCode, result.message, {
          ...result.meta,
          data: formatDiscountForResponse(result.meta.data)
        });
  } catch (error) {
    logger.logException('Error updating discount', { vendorId, discountId, error });
  }
};

const getDiscountById = async (req, res) => {
  const vendorId = req.vendorId;
  let discountId;
    try {
    const blockReason = await getDiscountFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    discountId = common.decodeId(req.params.id);
    const result = await discountService.fetchDiscountById(vendorId, discountId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, formatDiscountForResponse(result.meta.data));
  } catch (error) {
    logger.logException('Error fetching discount', { vendorId, discountId, error });
  }
};

const getAllDiscountsAdmin = async (req, res) => {
  const vendorId = req.vendorId;
    try {
    const blockReason = await getDiscountFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const result = await discountService.fetchDiscountsForAdmin(vendorId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.data.map(formatDiscountForResponse));
  } catch (error) {
    logger.logException('Error fetching discounts', { vendorId, error });
  }
};

const getActiveDiscounts = async (req, res) => {
  const vendorId = req.vendorId;
    try {
    const blockReason = await getDiscountFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const result = await discountService.fetchActiveDiscountsForUser(vendorId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.data.map(formatDiscountForResponse));
  } catch (error) {
    logger.logException('Error fetching active discounts', { vendorId, error });
  }
};

const deleteDiscount = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user && req.user._id;
  let discountId;
    try {
    const blockReason = await getDiscountFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    discountId = common.decodeId(req.params.id);
    const result = await discountService.deleteDiscount(vendorId, discountId, userId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message);
  } catch (error) {
    logger.logException('Error deleting discount', { vendorId, discountId, error });
  }
};

const bulkSetDiscountStatus = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user._id;
  const { status } = req.body;
  try {
    const decodedIds = req.body.discountIds.map((id) => common.decodeId(id));
    const result = await discountService.bulkSetDiscountStatus(vendorId, userId, decodedIds, status);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    const meta = {
      ...result.meta,
      results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
    };
    return common.sendSuccess(res, result.statusCode, result.message, meta);
  } catch (error) {
    logger.logException('discountController: bulkSetDiscountStatus - Exception while bulk updating discount status', { vendorId, error });
  }
};

const bulkDeleteDiscounts = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user._id;
  try {
    const decodedIds = req.body.discountIds.map((id) => common.decodeId(id));
    const result = await discountService.bulkDeleteDiscounts(vendorId, userId, decodedIds);
    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    const meta = {
      ...result.meta,
      results: result.meta.results.map((r) => ({ ...r, id: common.encodeId(r.id) }))
    };
    return common.sendSuccess(res, result.statusCode, result.message, meta);
  } catch (error) {
    logger.logException('discountController: bulkDeleteDiscounts - Exception while bulk deleting discounts', { vendorId, error });
  }
};

module.exports = {
  createDiscount,
  updateDiscount,
  getDiscountById,
  getAllDiscountsAdmin,
  getActiveDiscounts,
  deleteDiscount,
  bulkSetDiscountStatus,
  bulkDeleteDiscounts
};