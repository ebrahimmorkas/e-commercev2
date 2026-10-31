const realtimeService = require('./realtimeService');
const logger = require('../utils/logger');
const common = require('../utils/common');
const { REALTIME_NOTIFICATION_EVENT } = require('../constants/abandonedCartConstants');
const { REALTIME_MODULE_REVIEWS } = require('../constants/reviewConstants');

// Tells the vendor's admins that a customer posted / edited / deleted a
// review, so the Reviews page refreshes itself and can flag a review waiting
// for approval. Best-effort: never throws, always called after the review is
// saved. Admin channel only - customers are never told anything about the
// moderation of their reviews.
//
// The payload is a small delta - the page re-reads the list over REST.
const notifyReviewChanged = (review, type, extra = {}) => {
    try {
        if (!review) return;
        realtimeService.emitToVendorAdmins(review.vendorId, REALTIME_NOTIFICATION_EVENT, {
            module: REALTIME_MODULE_REVIEWS,
            type,
            data: {
                reviewId: common.encodeId(review._id),
                moderationStatus: review.moderationStatus,
                rating: review.rating,
                ...extra
            }
        });
    } catch (err) {
        logger.logWarning('Exception in reviewRealtimeService.notifyReviewChanged', { reviewId: review?._id, type, error: err });
    }
};

module.exports = { notifyReviewChanged };
