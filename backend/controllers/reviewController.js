const reviewService = require('../services/reviewService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');

const createReview = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;
    const { productId: encodedProductId, variantId: encodedVariantId, rating, comment, images } = req.body;

    const productId = common.decodeId(encodedProductId);
    const productIdCheck = common.validateObjectId(productId);
    if (!productIdCheck.valid) {
      return common.sendError(res, 400, productIdCheck.message);
    }

    let variantId = null;
    if (encodedVariantId) {
      variantId = common.decodeId(encodedVariantId);
      const variantIdCheck = common.validateObjectId(variantId);
      if (!variantIdCheck.valid) {
        return common.sendError(res, 400, variantIdCheck.message);
      }
    }

    const result = await reviewService.createReview(
      vendorId,
      userId,
      req.websiteMasterData,
      req.companyMasterData,
      productId,
      variantId,
      rating,
      comment,
      images
    );

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error creating review', { error });
  }
};

const getReviewsByProduct = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const productId = common.decodeId(req.params.productId);

    const idCheck = common.validateObjectId(productId);
    if (!idCheck.valid) {
      return common.sendError(res, 400, idCheck.message);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await reviewService.getReviewsByProductId(vendorId, productId, req.companySettingsData, page, limit);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching reviews by product', { error });
  }
};

const getReviewById = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const reviewId = common.decodeId(req.params.reviewId);

    const idCheck = common.validateObjectId(reviewId);
    if (!idCheck.valid) {
      return common.sendError(res, 400, idCheck.message);
    }

    const result = await reviewService.getReviewById(vendorId, reviewId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error fetching review by id', { error });
  }
};

const updateReview = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;
    const { reviewId: encodedReviewId, rating, comment, images } = req.body;

    const reviewId = common.decodeId(encodedReviewId);
    const idCheck = common.validateObjectId(reviewId);
    if (!idCheck.valid) {
      return common.sendError(res, 400, idCheck.message);
    }

    const result = await reviewService.updateReview(vendorId, userId, reviewId, { rating, comment, images });

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message, result.meta);
  } catch (error) {
    logger.logException('Error updating review', { error });
  }
};

const deleteReview = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const userId = req.user._id;
    const { reviewId: encodedReviewId } = req.body;

    const reviewId = common.decodeId(encodedReviewId);
    const idCheck = common.validateObjectId(reviewId);
    if (!idCheck.valid) {
      return common.sendError(res, 400, idCheck.message);
    }

    const result = await reviewService.deleteReview(vendorId, userId, reviewId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message);
  } catch (error) {
    logger.logException('Error deleting review', { error });
  }
};

const adminDeleteReview = async (req, res) => {
  try {
    const vendorId = req.vendorId;
    const adminUserId = req.user._id;
    const { reviewId: encodedReviewId } = req.body;

    const reviewId = common.decodeId(encodedReviewId);
    const idCheck = common.validateObjectId(reviewId);
    if (!idCheck.valid) {
      return common.sendError(res, 400, idCheck.message);
    }

    const result = await reviewService.adminDeleteReview(vendorId, adminUserId, reviewId);

    if (!result.isSuccess) {
      return common.sendError(res, result.statusCode, result.message);
    }
    return common.sendSuccess(res, result.statusCode, result.message);
  } catch (error) {
    logger.logException('Error deleting review as admin', { error });
  }
};

module.exports = {
  createReview,
  getReviewsByProduct,
  getReviewById,
  updateReview,
  deleteReview,
  adminDeleteReview
};