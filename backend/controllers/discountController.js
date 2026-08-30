const discountService = require('../services/discountService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

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
  // const userId = req.user._id;
  const userId = '6a63443e263b29b8e59374eb';
  try {
    const blockReason = await getDiscountFeatureBlockReason(req);
    console.log(`Block reason is ${blockReason}`);
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
    const result = await discountService.createDiscount(vendorId, userId, req.body, files, req.companyMasterData);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message, result.meta);
    }

        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error creating discount', { vendorId, error });
    return common.sendError(res, 500, 'Failed to create discount');
  }
};

const updateDiscount = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user && req.user._id;
  const discountId = req.params.id;
    try {
    const blockReason = await getDiscountFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const files = req.files || {};
    const result = await discountService.updateDiscount(vendorId, discountId, userId, req.body, files, req.companyMasterData);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message, result.meta);
    }

        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error updating discount', { vendorId, discountId, error });
    return common.sendError(res, 500, 'Failed to update discount');
  }
};

const getDiscountById = async (req, res) => {
  const vendorId = req.vendorId;
  const discountId = req.params.id;
    try {
    const blockReason = await getDiscountFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const result = await discountService.fetchDiscountById(vendorId, discountId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.data);
  } catch (error) {
    logger.logException('Error fetching discount', { vendorId, discountId, error });
    return common.sendError(res, 500, 'Failed to fetch discount');
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

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.data);
  } catch (error) {
    logger.logException('Error fetching discounts', { vendorId, error });
    return common.sendError(res, 500, 'Failed to fetch discounts');
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

    return common.sendSuccess(res, result.statusCode, result.message, result.meta.data);
  } catch (error) {
    logger.logException('Error fetching active discounts', { vendorId, error });
    return common.sendError(res, 500, 'Failed to fetch active discounts');
  }
};

const deleteDiscount = async (req, res) => {
  const vendorId = req.vendorId;
  const userId = req.user && req.user._id;
  const discountId = req.params.id;
    try {
    const blockReason = await getDiscountFeatureBlockReason(req);
    if (blockReason) {
      return common.sendError(res, blockReason.statusCode, blockReason.message);
    }

    const result = await discountService.deleteDiscount(vendorId, discountId, userId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }

    return common.sendSuccess(res, result.statusCode, result.message);
  } catch (error) {
    logger.logException('Error deleting discount', { vendorId, discountId, error });
    return common.sendError(res, 500, 'Failed to delete discount');
  }
};

module.exports = {
  createDiscount,
  updateDiscount,
  getDiscountById,
  getAllDiscountsAdmin,
  getActiveDiscounts,
  deleteDiscount
};