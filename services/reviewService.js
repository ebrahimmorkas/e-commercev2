const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const redisService = require('./redisService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');

const REVIEW_CACHE_TTL = 300; // reduced from the default 3600s since reviews mutate more often

// Internal helper — recompute Product.averageRating / totalReviews from active reviews.
const recalcProductRatingAggregate = async (vendorId, productId) => {
  try {
    const stats = await Review.aggregate([
      {
        $match: {
          vendorId: new mongoose.Types.ObjectId(vendorId),
          productId: new mongoose.Types.ObjectId(productId),
          status: 'A'
        }
      },
      {
        $group: {
          _id: '$productId',
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    const avgRating = stats.length ? stats[0].avgRating : 0;
    const count = stats.length ? stats[0].count : 0;

    await Product.findByIdAndUpdate(productId, {
      averageRating: avgRating,
      totalReviews: count
    });
  } catch (err) {
    throw err;
  }
};

const createReview = async (
  vendorId,
  userId,
  websiteMasterData,
  companyMasterData,
  productId,
  variantId,
  rating,
  comment,
  images
) => {
  try {
    const featureCheck = await common.checkFeatureOnOrOff(
      vendorId,
      websiteMasterData,
      companyMasterData,
      'isProductReviewFeatureOn',
      'isReviewFeatureOn'
    );
    if (!featureCheck.isSuccess) {
      return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
    }

    // Verified-purchase check against Order (see models/Order.js TODOs).
    const order = await Order.findOne({
      vendorId,
      userId,
      productId,
      ...(variantId ? { variantId } : {}),
      orderStatus: 'delivered',
      status: 'A'
    });

    if (!order) {
      return common.returnResult(false, 403, 'Only verified purchasers can review this product');
    }

    // Pre-check for duplicate instead of relying on catching the unique-index
    // error in the catch block, since the catch block must only "throw err".
    const existingReview = await Review.findOne({
      vendorId,
      productId,
      userId,
      orderId: order._id
    });
    if (existingReview) {
      return common.returnResult(false, 409, 'You have already reviewed this product for this order');
    }

    const cap = companyMasterData.numberOfReviewsAllowedOnProduct;
    if (cap === 0) {
      return common.returnResult(false, 403, 'Reviews are not allowed for this product');
    }
    if (cap) {
      const currentCount = await Review.countDocuments({ vendorId, productId, status: 'A' });
      if (currentCount >= cap) {
        return common.returnResult(false, 403, 'Maximum number of reviews allowed for this product has been reached');
      }
    }

    const review = await Review.create({
      vendorId,
      productId,
      variantId: variantId || null,
      userId,
      orderId: order._id,
      rating,
      comment,
      images,
      isVerifiedPurchase: true,
      createdBy: userId
    });

    await recalcProductRatingAggregate(vendorId, productId);
    await redisService.del(redisKeys.reviews(vendorId, productId));

    return common.returnResult(true, 201, 'Review created successfully', { review });
  } catch (err) {
    throw err;
  }
};

const getReviewsByProductId = async (vendorId, productId, companySettingsData, page = 1, limit = 10) => {
  try {
    if (!companySettingsData.showReviewsToCustomers) {
      return common.returnResult(false, 403, 'Reviews are not enabled for this store');
    }

    const cacheKey = redisKeys.reviews(vendorId, productId);
    let reviews = await redisService.get(cacheKey);

    if (!reviews) {
      reviews = await Review.find({ vendorId, productId, status: 'A' })
        .sort({ createdAt: -1 })
        .lean();
      await redisService.set(cacheKey, reviews, REVIEW_CACHE_TTL);
    }

    const total = reviews.length;
    const startIndex = (page - 1) * limit;
    const paginatedReviews = reviews.slice(startIndex, startIndex + limit);

    return common.returnResult(true, 200, 'Reviews fetched successfully', {
      reviews: paginatedReviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    throw err;
  }
};

const getReviewById = async (vendorId, reviewId) => {
  try {
    const review = await Review.findOne({ _id: reviewId, vendorId, status: 'A' });
    if (!review) {
      return common.returnResult(false, 404, 'Review not found');
    }
    return common.returnResult(true, 200, 'Review fetched successfully', { review });
  } catch (err) {
    throw err;
  }
};

const updateReview = async (vendorId, userId, reviewId, updates) => {
  try {
    const review = await Review.findOne({ _id: reviewId, vendorId, status: 'A' });
    if (!review) {
      return common.returnResult(false, 404, 'Review not found');
    }
    if (review.userId.toString() !== userId.toString()) {
      return common.returnResult(false, 403, 'You are not authorized to update this review');
    }

    if (updates.rating !== undefined) review.rating = updates.rating;
    if (updates.comment !== undefined) review.comment = updates.comment;
    if (updates.images !== undefined) review.images = updates.images;
    review.updatedBy = userId;

    await review.save();

    await recalcProductRatingAggregate(vendorId, review.productId);
    await redisService.del(redisKeys.reviews(vendorId, review.productId));

    return common.returnResult(true, 200, 'Review updated successfully', { review });
  } catch (err) {
    throw err;
  }
};

const deleteReview = async (vendorId, userId, reviewId) => {
  try {
    const review = await Review.findOne({ _id: reviewId, vendorId, status: 'A' });
    if (!review) {
      return common.returnResult(false, 404, 'Review not found');
    }
    if (review.userId.toString() !== userId.toString()) {
      return common.returnResult(false, 403, 'You are not authorized to delete this review');
    }

    review.status = 'D';
    review.deletedBy = userId;
    await review.save();

    await recalcProductRatingAggregate(vendorId, review.productId);
    await redisService.del(redisKeys.reviews(vendorId, review.productId));

    return common.returnResult(true, 200, 'Review deleted successfully');
  } catch (err) {
    throw err;
  }
};

const adminDeleteReview = async (vendorId, adminUserId, reviewId) => {
  try {
    const review = await Review.findOne({ _id: reviewId, vendorId, status: 'A' });
    if (!review) {
      return common.returnResult(false, 404, 'Review not found');
    }

    review.status = 'D';
    review.deletedBy = adminUserId;
    // Requires the `remarks` field you're adding to Review.js locally.
    review.remarks = 'Deleted by admin';
    await review.save();

    await recalcProductRatingAggregate(vendorId, review.productId);
    await redisService.del(redisKeys.reviews(vendorId, review.productId));

    return common.returnResult(true, 200, 'Review deleted by admin successfully');
  } catch (err) {
    throw err;
  }
};

module.exports = {
  createReview,
  getReviewsByProductId,
  getReviewById,
  updateReview,
  deleteReview,
  adminDeleteReview
};