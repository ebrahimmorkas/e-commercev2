const reviewService = require('../services/reviewService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');
const { DEFAULT_REVIEW_PAGE_SIZE, MAX_REVIEW_PAGE_SIZE, VALID_REVIEW_SORTS, REVIEW_SORTS } = require('../constants/reviewConstants');

const encodeIfPresent = (id) => (id ? common.encodeId(id) : id);

// Encoded id from the client -> raw ObjectId string, or null when it was
// tampered with / not an id of ours.
const decodeClientId = (encodedId) => {
    try {
        const decoded = common.tryDecodeId(encodedId);
        if (!decoded) return null;
        return common.validateObjectId(decoded).valid ? decoded : null;
    } catch (err) {
        throw err;
    }
};

const formatContentFields = (content) => {
    try {
        return {
            rating: content.rating,
            title: content.title || '',
            comment: content.comment || '',
            images: (content.images || []).map((image) => ({ _id: image._id?.toString(), url: image.url }))
        };
    } catch (err) {
        throw err;
    }
};

// A review as other shoppers see it: its PUBLISHED version, the reviewer
// shown by name only (never their user id, order id, moderation details or
// audit fields), and nothing that says an admin changed it.
const formatPublicReview = (reviewDoc) => {
    try {
        if (!reviewDoc) return reviewDoc;
        const review = reviewDoc.toObject ? reviewDoc.toObject() : reviewDoc;
        const reviewer = review.userId && typeof review.userId === 'object' && review.userId.name !== undefined ? review.userId : null;

        return {
            _id: encodeIfPresent(review._id),
            productId: encodeIfPresent(review.productId),
            reviewerName: reviewer?.name?.trim() || 'Customer',
            ...formatContentFields(review.publishedContent || review),
            variantName: review.variantName || null,
            sizeName: review.sizeName || null,
            isVerifiedPurchase: !!review.isVerifiedPurchase,
            createdAt: review.createdAt
        };
    } catch (err) {
        throw err;
    }
};

// The customer's own review: its CURRENT content (their latest edit, even
// while it waits for approval) plus the order it belongs to. Moderation is
// never revealed to the customer.
const formatOwnReview = (reviewDoc) => {
    try {
        if (!reviewDoc) return reviewDoc;
        const review = reviewDoc.toObject ? reviewDoc.toObject() : reviewDoc;
        return {
            _id: encodeIfPresent(review._id),
            productId: encodeIfPresent(review.productId),
            orderId: encodeIfPresent(review.orderId),
            ...formatContentFields(review),
            variantName: review.variantName || null,
            sizeName: review.sizeName || null,
            isVerifiedPurchase: !!review.isVerifiedPurchase,
            createdAt: review.createdAt
        };
    } catch (err) {
        throw err;
    }
};

// Duplicate key = two submits for the same order raced past the pre-check;
// the unique index stopped the second one. Answered before logException,
// which otherwise sends its own 500.
const handleError = (res, message, error, context = {}) => {
    try {
        if (error && error.code === 11000 && !res.headersSent) {
            common.sendError(res, 409, 'You have already reviewed this product for this order. You can edit your review instead.');
        }
        logger.logException(message, { ...context, error });
    } catch (err) {
        logger.logException('reviewController - handleError: Exception while handling an error', { error: err });
    }
};

const getReviewSettings = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const result = await reviewService.getReviewSettings(vendorId, req.websiteMasterData, req.companyMasterData, req.companySettingsData);
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, result.meta);
    } catch (error) {
        logger.logException('reviewController - getReviewSettings: Exception while fetching review settings', { vendorId, error });
    }
};

const createReview = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const productId = decodeClientId(req.body.productId);
        if (!productId) {
            return common.sendError(res, 400, 'Product is not valid.');
        }
        const orderId = decodeClientId(req.body.orderId);
        if (!orderId) {
            return common.sendError(res, 400, 'Order is not valid.');
        }

        const result = await reviewService.createReview({
            vendorId,
            userId: req.user._id,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            companySettingsData: req.companySettingsData,
            productId,
            orderId,
            rating: req.body.rating,
            title: req.body.title,
            comment: req.body.comment,
            files: req.files || []
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, { review: formatOwnReview(result.meta.review) });
    } catch (error) {
        handleError(res, 'reviewController - createReview: Exception while creating review', error, { vendorId });
    }
};

const updateReview = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const reviewId = decodeClientId(req.body.reviewId);
        if (!reviewId) {
            return common.sendError(res, 400, 'Review is not valid.');
        }

        const { rating, title, comment, removeImageIds = [] } = req.body;
        const files = req.files || [];
        if (rating === undefined && title === undefined && comment === undefined && removeImageIds.length === 0 && files.length === 0) {
            return common.sendError(res, 400, 'Nothing to update.');
        }

        const result = await reviewService.updateReview({
            vendorId,
            userId: req.user._id,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            reviewId,
            updates: { rating, title, comment },
            removeImageIds,
            files
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, { review: formatOwnReview(result.meta.review) });
    } catch (error) {
        handleError(res, 'reviewController - updateReview: Exception while updating review', error, { vendorId });
    }
};

const deleteReview = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const reviewId = decodeClientId(req.body.reviewId);
        if (!reviewId) {
            return common.sendError(res, 400, 'Review is not valid.');
        }

        const result = await reviewService.deleteReview({
            vendorId,
            userId: req.user._id,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            reviewId
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('reviewController - deleteReview: Exception while deleting review', { vendorId, error });
    }
};

const getMyProductReviewStatus = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const productId = decodeClientId(req.params.productId);
        if (!productId) {
            return common.sendError(res, 400, 'Product is not valid.');
        }

        const result = await reviewService.getMyProductReviewStatus({
            vendorId,
            userId: req.user._id,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            companySettingsData: req.companySettingsData,
            productId
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        const { eligibleOrders, myReviews, ...rest } = result.meta;
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...rest,
            eligibleOrders: eligibleOrders.map((order) => ({ ...order, orderId: encodeIfPresent(order.orderId) })),
            myReviews: myReviews.map(formatOwnReview)
        });
    } catch (error) {
        logger.logException('reviewController - getMyProductReviewStatus: Exception while fetching review status', { vendorId, error });
    }
};

const getMyOrderReviewStatus = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const orderId = decodeClientId(req.params.orderId);
        if (!orderId) {
            return common.sendError(res, 400, 'Order is not valid.');
        }

        const result = await reviewService.getMyOrderReviewStatus({
            vendorId,
            userId: req.user._id,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            companySettingsData: req.companySettingsData,
            orderId
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            isDelivered: result.meta.isDelivered,
            products: result.meta.products.map((entry) => ({
                productId: encodeIfPresent(entry.productId),
                canWrite: entry.canWrite,
                review: entry.review ? formatOwnReview(entry.review) : null
            }))
        });
    } catch (error) {
        logger.logException('reviewController - getMyOrderReviewStatus: Exception while fetching order review status', { vendorId, error });
    }
};

const getReviewsByProduct = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const productId = decodeClientId(req.params.productId);
        if (!productId) {
            return common.sendError(res, 400, 'Product is not valid.');
        }

        // Already checked by listReviewsQuerySchema; parsed here because
        // Express 5's req.query can't be replaced with Joi's converted copy.
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(MAX_REVIEW_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_REVIEW_PAGE_SIZE));
        const sort = VALID_REVIEW_SORTS.includes(req.query.sort) ? req.query.sort : REVIEW_SORTS.RECENT;
        const rating = parseInt(req.query.rating, 10);

        const result = await reviewService.getReviewsByProductId({
            vendorId,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            companySettingsData: req.companySettingsData,
            productId,
            page,
            limit,
            sort,
            rating: rating >= 1 && rating <= 5 ? rating : null
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            reviews: result.meta.reviews.map(formatPublicReview)
        });
    } catch (error) {
        logger.logException('reviewController - getReviewsByProduct: Exception while fetching product reviews', { vendorId, error });
    }
};

const getReviewById = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const reviewId = decodeClientId(req.params.reviewId);
        if (!reviewId) {
            return common.sendError(res, 400, 'Review is not valid.');
        }

        const result = await reviewService.getReviewById({
            vendorId,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            companySettingsData: req.companySettingsData,
            reviewId
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, { review: formatPublicReview(result.meta.review) });
    } catch (error) {
        logger.logException('reviewController - getReviewById: Exception while fetching review', { vendorId, error });
    }
};

module.exports = {
    getReviewSettings,
    createReview,
    updateReview,
    deleteReview,
    getMyProductReviewStatus,
    getMyOrderReviewStatus,
    getReviewsByProduct,
    getReviewById
};
