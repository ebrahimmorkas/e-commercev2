const reviewAdminService = require('../services/reviewAdminService');
const logger = require('../utils/logger.js');
const common = require('../utils/common.js');
const {
    ADMIN_REVIEW_FILTER_STATUSES,
    VALID_ADMIN_REVIEW_FILTER_STATUSES,
    ADMIN_REVIEW_SORTS,
    VALID_ADMIN_REVIEW_SORTS,
    DEFAULT_ADMIN_REVIEW_PAGE_SIZE,
    MAX_ADMIN_REVIEW_PAGE_SIZE,
    REVIEW_MODERATION_STATUSES
} = require('../constants/reviewConstants');

const encodeIfPresent = (id) => (id ? common.encodeId(id) : id);

// Encoded id from the client -> raw ObjectId string, or null when invalid.
const decodeClientId = (encodedId) => {
    try {
        const decoded = common.tryDecodeId(encodedId);
        if (!decoded) return null;
        return common.validateObjectId(decoded).valid ? decoded : null;
    } catch (err) {
        throw err;
    }
};

// Every id decoded, or null if any one is invalid.
const decodeClientIds = (encodedIds) => {
    try {
        const decoded = (encodedIds || []).map(decodeClientId);
        return decoded.every(Boolean) ? decoded : null;
    } catch (err) {
        throw err;
    }
};

const formatContent = (content) => {
    try {
        if (!content) return null;
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

// A populated ref -> { _id (encoded), name } or null.
const formatPerson = (person) => {
    try {
        if (!person || typeof person !== 'object' || person.name === undefined) return null;
        return { _id: encodeIfPresent(person._id), name: person.name || '', email: person.email, role: person.role };
    } catch (err) {
        throw err;
    }
};

const formatAdminReview = (reviewDoc, { withHistory = false } = {}) => {
    try {
        if (!reviewDoc) return reviewDoc;
        const review = reviewDoc.toObject ? reviewDoc.toObject() : reviewDoc;
        const product = review.productId && typeof review.productId === 'object' && review.productId.name !== undefined ? review.productId : null;
        const order = review.orderId && typeof review.orderId === 'object' && review.orderId.orderNumber !== undefined ? review.orderId : null;

        const formatted = {
            _id: encodeIfPresent(review._id),
            product: product ? { _id: encodeIfPresent(product._id), name: product.name } : { _id: encodeIfPresent(review.productId), name: null },
            customer: formatPerson(review.userId),
            orderNumber: order ? order.orderNumber : null,
            variantName: review.variantName || null,
            sizeName: review.sizeName || null,
            isVerifiedPurchase: !!review.isVerifiedPurchase,
            ...formatContent(review),
            publishedContent: formatContent(review.publishedContent),
            // Approved before, and a newer edit is waiting: the old version is still live.
            hasPendingChanges: review.moderationStatus === REVIEW_MODERATION_STATUSES.PENDING && !!review.publishedContent,
            moderationStatus: review.moderationStatus || REVIEW_MODERATION_STATUSES.APPROVED,
            isDeleted: review.status === 'D',
            remarks: review.remarks || null,
            rejectionReason: review.rejectionReason || null,
            moderatedBy: formatPerson(review.moderatedBy),
            moderatedAt: review.moderatedAt || null,
            isEditedByAdmin: !!review.isEditedByAdmin,
            adminEditedBy: formatPerson(review.adminEditedBy),
            adminEditedAt: review.adminEditedAt || null,
            publishedAt: review.publishedAt || null,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt
        };

        if (withHistory) {
            formatted.originalContent = formatContent(review.originalContent);
            formatted.deletedBy = formatPerson(review.deletedBy);
            formatted.history = (review.history || [])
                .slice()
                .reverse()
                .map((entry) => ({
                    _id: entry._id?.toString(),
                    action: entry.action,
                    by: formatPerson(entry.by),
                    byRole: entry.byRole,
                    at: entry.at,
                    before: formatContent(entry.before),
                    after: formatContent(entry.after),
                    reason: entry.reason || null
                }));
        }
        return formatted;
    } catch (err) {
        throw err;
    }
};

// A date-only "to" date covers that whole day.
const parseDate = (value, endOfDay = false) => {
    try {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) date.setHours(23, 59, 59, 999);
        return date;
    } catch (err) {
        throw err;
    }
};

const listReviews = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        // Already checked by adminListReviewsQuerySchema; parsed here because
        // Express 5's req.query can't be replaced with Joi's converted copy.
        const query = req.query;
        let productId = null;
        if (query.productId) {
            productId = decodeClientId(query.productId);
            if (!productId) {
                return common.sendError(res, 400, 'Product is not valid.');
            }
        }
        const rating = parseInt(query.rating, 10);
        const filters = {
            status: VALID_ADMIN_REVIEW_FILTER_STATUSES.includes(query.status) ? query.status : ADMIN_REVIEW_FILTER_STATUSES.ALL,
            search: (query.search || '').trim(),
            productId,
            rating: rating >= 1 && rating <= 5 ? rating : null,
            fromDate: parseDate(query.fromDate),
            toDate: parseDate(query.toDate, true),
            sort: VALID_ADMIN_REVIEW_SORTS.includes(query.sort) ? query.sort : ADMIN_REVIEW_SORTS.PENDING_FIRST,
            page: Math.max(1, parseInt(query.page, 10) || 1),
            limit: Math.min(MAX_ADMIN_REVIEW_PAGE_SIZE, Math.max(1, parseInt(query.limit, 10) || DEFAULT_ADMIN_REVIEW_PAGE_SIZE))
        };

        const result = await reviewAdminService.listReviews({
            vendorId,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            filters
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            ...result.meta,
            reviews: result.meta.reviews.map((review) => formatAdminReview(review))
        });
    } catch (error) {
        logger.logException('reviewAdminController - listReviews: Exception while listing reviews', { vendorId, error });
    }
};

const getReviewDetail = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const reviewId = decodeClientId(req.params.reviewId);
        if (!reviewId) {
            return common.sendError(res, 400, 'Review is not valid.');
        }

        const result = await reviewAdminService.getReviewDetail({
            vendorId,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            reviewId
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, {
            review: formatAdminReview(result.meta.review, { withHistory: true }),
            permissions: result.meta.permissions
        });
    } catch (error) {
        logger.logException('reviewAdminController - getReviewDetail: Exception while fetching review', { vendorId, error });
    }
};

const updateReview = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const reviewId = decodeClientId(req.body.reviewId);
        if (!reviewId) {
            return common.sendError(res, 400, 'Review is not valid.');
        }

        const { rating, title, comment, removeImageIds = [], approve = false } = req.body;
        const files = req.files || [];
        if (rating === undefined && title === undefined && comment === undefined && removeImageIds.length === 0 && files.length === 0 && !approve) {
            return common.sendError(res, 400, 'Nothing to update.');
        }

        const result = await reviewAdminService.updateReview({
            vendorId,
            adminUserId: req.user._id,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            reviewId,
            updates: { rating, title, comment },
            removeImageIds,
            files,
            approve
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message, { review: formatAdminReview(result.meta.review) });
    } catch (error) {
        logger.logException('reviewAdminController - updateReview: Exception while updating review', { vendorId, error });
    }
};

// approve / reject / delete share the "list of selected reviews" shape.
const runBulkAction = (serviceMethod, label) => async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const reviewIds = decodeClientIds(req.body.reviewIds);
        if (!reviewIds) {
            return common.sendError(res, 400, 'One of the selected reviews is not valid.');
        }

        const result = await reviewAdminService[serviceMethod]({
            vendorId,
            adminUserId: req.user._id,
            websiteMasterData: req.websiteMasterData,
            companyMasterData: req.companyMasterData,
            reviewIds,
            reason: req.body.reason
        });

        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        // The message ("3 reviews approved. 1 skipped ...") is repeated in
        // data, since the admin client only reads `data`.
        return common.sendSuccess(res, result.statusCode, result.message, { ...result.meta, message: result.message });
    } catch (error) {
        logger.logException(`reviewAdminController - ${label}: Exception while running a review action`, { vendorId, error });
    }
};

const approveReviews = runBulkAction('approveReviews', 'approveReviews');
const rejectReviews = runBulkAction('rejectReviews', 'rejectReviews');
const deleteReviews = runBulkAction('deleteReviews', 'deleteReviews');

// Single delete (body: { reviewId }) - kept for the existing DELETE /admin route.
const deleteReview = async (req, res) => {
    const vendorId = req.vendorId;
    try {
        const reviewId = decodeClientId(req.body.reviewId);
        if (!reviewId) {
            return common.sendError(res, 400, 'Review is not valid.');
        }
        const result = await reviewAdminService.deleteReviews({ vendorId, adminUserId: req.user._id, reviewIds: [reviewId] });
        if (!result.isSuccess) {
            return common.sendError(res, result.statusCode, result.message);
        }
        return common.sendSuccess(res, result.statusCode, result.message);
    } catch (error) {
        logger.logException('reviewAdminController - deleteReview: Exception while deleting review', { vendorId, error });
    }
};

module.exports = {
    listReviews,
    getReviewDetail,
    updateReview,
    approveReviews,
    rejectReviews,
    deleteReviews,
    deleteReview
};
