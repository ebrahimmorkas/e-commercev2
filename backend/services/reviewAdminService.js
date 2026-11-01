const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const User = require('../models/User');
const common = require('../utils/common');
const reviewService = require('./reviewService');
const {
    REVIEW_MODERATION_STATUSES,
    REVIEW_HISTORY_ACTIONS,
    REVIEW_DELETE_REMARKS,
    ADMIN_REVIEW_FILTER_STATUSES,
    ADMIN_REVIEW_SORTS
} = require('../constants/reviewConstants');

// Admin Reviews module. What the admin may do depends on two switches (each
// on in BOTH WebsiteMaster and CompanyMaster):
//   isReviewEditingFeatureOn       - edit any review (rating, headline, text, photos)
//   isReviewApproveRejectFeatureOn - customers' reviews/edits wait for approval
// Delete is always available. See reviewService.js for how the current and
// published versions of a review relate.

const getAdminPermissions = (websiteMasterData, companyMasterData) => {
    try {
        const { approvalOn, editingOn } = reviewService.getModerationFlags(websiteMasterData, companyMasterData);
        return {
            canEdit: editingOn,
            canApproveReject: approvalOn,
            canDelete: true,
            maxImagesPerReview: reviewService.getMaxImagesPerReview(companyMasterData),
            maxImageSizeMB: companyMasterData?.allowedReviewImageMB ?? null,
            allowedImageFormats: companyMasterData?.allowedReviewImagesFormat || []
        };
    } catch (err) {
        throw err;
    }
};

const escapeRegex = (text) => {
    try {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } catch (err) {
        throw err;
    }
};

const STATUS_FILTERS = {
    [ADMIN_REVIEW_FILTER_STATUSES.ALL]: { status: 'A' },
    [ADMIN_REVIEW_FILTER_STATUSES.PENDING]: { status: 'A', moderationStatus: REVIEW_MODERATION_STATUSES.PENDING },
    [ADMIN_REVIEW_FILTER_STATUSES.APPROVED]: { status: 'A', moderationStatus: REVIEW_MODERATION_STATUSES.APPROVED },
    [ADMIN_REVIEW_FILTER_STATUSES.REJECTED]: { status: 'A', moderationStatus: REVIEW_MODERATION_STATUSES.REJECTED },
    [ADMIN_REVIEW_FILTER_STATUSES.DELETED]: { status: 'D' }
};

const SORT_STAGES = {
    [ADMIN_REVIEW_SORTS.PENDING_FIRST]: { pendingRank: 1, createdAt: -1 },
    [ADMIN_REVIEW_SORTS.NEWEST]: { createdAt: -1 },
    [ADMIN_REVIEW_SORTS.OLDEST]: { createdAt: 1 },
    [ADMIN_REVIEW_SORTS.HIGHEST]: { rating: -1, createdAt: -1 },
    [ADMIN_REVIEW_SORTS.LOWEST]: { rating: 1, createdAt: -1 }
};

// Search: customer name / email / username, or product name.
const buildSearchFilter = async (vendorId, search) => {
    try {
        const pattern = new RegExp(escapeRegex(search), 'i');
        const [users, products] = await Promise.all([
            User.find({ vendorId, $or: [{ name: pattern }, { email: pattern }, { username: pattern }] }).select('_id').limit(500).lean(),
            Product.find({ vendorId, name: pattern }).select('_id').limit(500).lean()
        ]);
        return {
            $or: [
                { userId: { $in: users.map((user) => user._id) } },
                { productId: { $in: products.map((product) => product._id) } }
            ]
        };
    } catch (err) {
        throw err;
    }
};

const listReviews = async ({ vendorId, websiteMasterData, companyMasterData, filters }) => {
    try {
        // Approve/reject switched off: anything left waiting goes live first.
        await reviewService.settlePendingReviews({ vendorId, websiteMasterData, companyMasterData });

        const { status, search, productId, rating, fromDate, toDate, sort, page, limit } = filters;
        const vendorObjectId = new mongoose.Types.ObjectId(vendorId);

        const baseFilter = { vendorId: vendorObjectId };
        if (productId) baseFilter.productId = new mongoose.Types.ObjectId(productId);
        if (rating) baseFilter.rating = rating;
        if (fromDate || toDate) {
            baseFilter.createdAt = {};
            if (fromDate) baseFilter.createdAt.$gte = fromDate;
            if (toDate) baseFilter.createdAt.$lte = toDate;
        }
        if (search) Object.assign(baseFilter, await buildSearchFilter(vendorObjectId, search));

        const listFilter = { ...baseFilter, ...STATUS_FILTERS[status] };

        const [rows, total, countRows, deletedCount] = await Promise.all([
            Review.aggregate([
                { $match: listFilter },
                { $addFields: { pendingRank: { $cond: [{ $eq: ['$moderationStatus', REVIEW_MODERATION_STATUSES.PENDING] }, 0, 1] } } },
                { $sort: SORT_STAGES[sort] || SORT_STAGES[ADMIN_REVIEW_SORTS.PENDING_FIRST] },
                { $skip: (page - 1) * limit },
                { $limit: limit },
                { $project: { history: 0, pendingRank: 0 } }
            ]),
            Review.countDocuments(listFilter),
            // Tab counts follow every filter except the status tab itself.
            Review.aggregate([
                { $match: { ...baseFilter, status: 'A' } },
                { $group: { _id: '$moderationStatus', count: { $sum: 1 } } }
            ]),
            Review.countDocuments({ ...baseFilter, status: 'D' })
        ]);

        const reviews = await Review.populate(rows, [
            { path: 'userId', select: 'name email' },
            { path: 'productId', select: 'name' },
            { path: 'orderId', select: 'orderNumber' }
        ]);

        const counts = { all: 0, pending: 0, approved: 0, rejected: 0, deleted: deletedCount };
        for (const row of countRows) {
            const key = String(row._id || REVIEW_MODERATION_STATUSES.APPROVED).toLowerCase();
            if (counts[key] !== undefined) counts[key] += row.count;
            counts.all += row.count;
        }

        return common.returnResult(true, 200, 'Reviews fetched successfully', {
            reviews,
            counts,
            permissions: getAdminPermissions(websiteMasterData, companyMasterData),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total }
        });
    } catch (err) {
        throw err;
    }
};

const getReviewDetail = async ({ vendorId, websiteMasterData, companyMasterData, reviewId }) => {
    try {
        const review = await Review.findOne({ _id: reviewId, vendorId })
            .populate('userId', 'name email')
            .populate('productId', 'name')
            .populate('orderId', 'orderNumber')
            .populate('moderatedBy', 'name')
            .populate('adminEditedBy', 'name')
            .populate('deletedBy', 'name')
            .populate('history.by', 'name role')
            .lean();
        if (!review) {
            return common.returnResult(false, 404, 'Review not found.');
        }
        return common.returnResult(true, 200, 'Review fetched successfully', {
            review,
            permissions: getAdminPermissions(websiteMasterData, companyMasterData)
        });
    } catch (err) {
        throw err;
    }
};

// Admin edit. `approve` = "Save & approve" (needs the approve/reject switch).
//   approve/reject off  -> the edit goes live straight away.
//   Save & approve      -> goes live and the review is approved.
//   Save on an approved review -> goes live (the admin is the moderator).
//   Save on a pending/rejected review -> stays as it is (its earlier
//                                        published version, if any, stays live).
const updateReview = async ({
    vendorId,
    adminUserId,
    websiteMasterData,
    companyMasterData,
    reviewId,
    updates,
    removeImageIds = [],
    files = [],
    approve = false
}) => {
    try {
        const { approvalOn, editingOn } = reviewService.getModerationFlags(websiteMasterData, companyMasterData);
        if (!editingOn) {
            return common.returnResult(false, 403, 'Editing reviews is not available for your account.');
        }
        if (approve && !approvalOn) {
            return common.returnResult(false, 403, 'Approving reviews is not available for your account.');
        }

        const review = await Review.findOne({ _id: reviewId, vendorId, status: 'A' });
        if (!review) {
            return common.returnResult(false, 404, 'Review not found.');
        }

        const keptResult = reviewService.resolveKeptImages(review, removeImageIds);
        if (keptResult.error) {
            return keptResult.error;
        }
        // The admin may add photos even while customers can't; the per-review cap still applies.
        const imageCheck = reviewService.checkImageRules(files, keptResult.kept.length, websiteMasterData, companyMasterData, false);
        if (!imageCheck.isSuccess) {
            return imageCheck;
        }

        const uploadedImages = [];
        let saved = false;
        try {
            if (files.length) {
                const uploadResult = await reviewService.uploadReviewImages({ vendorId, userId: adminUserId, files, companyMasterData, websiteMasterData, uploaded: uploadedImages });
                if (!uploadResult.isSuccess) {
                    return uploadResult;
                }
            }

            const now = new Date();
            const before = reviewService.snapshotContent(review);
            const publishedBefore = review.publishedContent ? review.publishedContent.toObject() : null;

            if (updates.rating !== undefined) review.rating = updates.rating;
            if (updates.title !== undefined) review.title = updates.title;
            if (updates.comment !== undefined) review.comment = updates.comment;
            review.images = [...reviewService.copyImages(keptResult.kept), ...uploadedImages];
            review.updatedBy = adminUserId;
            review.isEditedByAdmin = true;
            review.adminEditedBy = adminUserId;
            review.adminEditedAt = now;

            reviewService.addHistory(review, {
                action: REVIEW_HISTORY_ACTIONS.ADMIN_EDIT,
                by: adminUserId,
                byRole: 'admin',
                before,
                after: reviewService.snapshotContent(review)
            });

            const status = review.moderationStatus;
            if (!approvalOn || approve || status === REVIEW_MODERATION_STATUSES.APPROVED) {
                reviewService.publishCurrentContent(review, now);
            }
            if (approve) {
                review.moderatedBy = adminUserId;
                review.moderatedAt = now;
                review.rejectionReason = null;
                reviewService.addHistory(review, {
                    action: REVIEW_HISTORY_ACTIONS.APPROVED,
                    by: adminUserId,
                    byRole: 'admin',
                    before: publishedBefore,
                    after: reviewService.snapshotContent(review)
                });
            }

            await review.save();
            saved = true;

            await reviewService.refreshProductReviewData(vendorId, review.productId);

            return common.returnResult(true, 200, approve ? 'Review saved and approved.' : 'Review saved.', { review });
        } finally {
            if (!saved && uploadedImages.length) {
                await reviewService.removeReviewImages(uploadedImages, adminUserId);
            }
        }
    } catch (err) {
        throw err;
    }
};

const pluralReviews = (count) => {
    try {
        return `${count} review${count === 1 ? '' : 's'}`;
    } catch (err) {
        throw err;
    }
};

// Approves pending (or previously rejected) reviews: the current content goes live.
const approveReviews = async ({ vendorId, adminUserId, websiteMasterData, companyMasterData, reviewIds }) => {
    try {
        if (!reviewService.getModerationFlags(websiteMasterData, companyMasterData).approvalOn) {
            return common.returnResult(false, 403, 'Approving reviews is not available for your account.');
        }

        const reviews = await Review.find({
            _id: { $in: reviewIds },
            vendorId,
            status: 'A',
            moderationStatus: { $in: [REVIEW_MODERATION_STATUSES.PENDING, REVIEW_MODERATION_STATUSES.REJECTED] }
        });

        const now = new Date();
        const productIds = new Set();
        for (const review of reviews) {
            const publishedBefore = review.publishedContent ? review.publishedContent.toObject() : null;
            reviewService.publishCurrentContent(review, now);
            review.moderatedBy = adminUserId;
            review.moderatedAt = now;
            review.rejectionReason = null;
            review.updatedBy = adminUserId;
            reviewService.addHistory(review, {
                action: REVIEW_HISTORY_ACTIONS.APPROVED,
                by: adminUserId,
                byRole: 'admin',
                before: publishedBefore,
                after: reviewService.snapshotContent(review)
            });
            await review.save();
            productIds.add(review.productId.toString());
        }
        for (const id of productIds) {
            await reviewService.refreshProductReviewData(vendorId, id);
        }

        if (reviews.length === 0) {
            return common.returnResult(false, 409, 'None of the selected reviews is waiting for approval.');
        }
        const skipped = reviewIds.length - reviews.length;
        return common.returnResult(true, 200,
            `${pluralReviews(reviews.length)} approved.${skipped ? ` ${skipped} skipped (not waiting for approval).` : ''}`,
            { approvedCount: reviews.length, skippedCount: skipped });
    } catch (err) {
        throw err;
    }
};

// Rejects pending reviews. The customer is never told.
//   A new review          -> REJECTED: hidden from everyone, the customer too.
//   An edit of an approved review -> the edit is thrown away: the review goes
//                            back to its published version and stays live.
const rejectReviews = async ({ vendorId, adminUserId, websiteMasterData, companyMasterData, reviewIds, reason }) => {
    try {
        if (!reviewService.getModerationFlags(websiteMasterData, companyMasterData).approvalOn) {
            return common.returnResult(false, 403, 'Rejecting reviews is not available for your account.');
        }

        const reviews = await Review.find({
            _id: { $in: reviewIds },
            vendorId,
            status: 'A',
            moderationStatus: REVIEW_MODERATION_STATUSES.PENDING
        });

        const now = new Date();
        let editsRejected = 0;
        for (const review of reviews) {
            const before = reviewService.snapshotContent(review);
            review.moderatedBy = adminUserId;
            review.moderatedAt = now;
            review.rejectionReason = reason || null;
            review.updatedBy = adminUserId;

            if (review.publishedContent) {
                const published = review.publishedContent.toObject();
                review.rating = published.rating;
                review.title = published.title;
                review.comment = published.comment;
                review.images = reviewService.copyImages(published.images);
                review.moderationStatus = REVIEW_MODERATION_STATUSES.APPROVED;
                editsRejected += 1;
                reviewService.addHistory(review, {
                    action: REVIEW_HISTORY_ACTIONS.EDIT_REJECTED,
                    by: adminUserId,
                    byRole: 'admin',
                    before,
                    after: reviewService.snapshotContent(review),
                    reason: reason || null
                });
            } else {
                review.moderationStatus = REVIEW_MODERATION_STATUSES.REJECTED;
                reviewService.addHistory(review, {
                    action: REVIEW_HISTORY_ACTIONS.REJECTED,
                    by: adminUserId,
                    byRole: 'admin',
                    before,
                    after: null,
                    reason: reason || null
                });
            }
            await review.save();
        }

        if (reviews.length === 0) {
            return common.returnResult(false, 409, 'None of the selected reviews is waiting for approval.');
        }
        const skipped = reviewIds.length - reviews.length;
        const parts = [`${pluralReviews(reviews.length)} rejected.`];
        if (editsRejected) parts.push(`${editsRejected} of them ${editsRejected === 1 ? 'was an edit' : 'were edits'} - the earlier approved version stays live.`);
        if (skipped) parts.push(`${skipped} skipped (not waiting for approval).`);
        return common.returnResult(true, 200, parts.join(' '), { rejectedCount: reviews.length, editsRejectedCount: editsRejected, skippedCount: skipped });
    } catch (err) {
        throw err;
    }
};

// Always available - even with both switches (or reviews themselves) off.
const deleteReviews = async ({ vendorId, adminUserId, reviewIds }) => {
    try {
        const reviews = await Review.find({ _id: { $in: reviewIds }, vendorId, status: 'A' });
        if (reviews.length === 0) {
            return common.returnResult(false, 404, reviewIds.length === 1 ? 'Review not found.' : 'None of the selected reviews was found.');
        }

        const productIds = new Set();
        for (const review of reviews) {
            review.status = 'D';
            review.deletedBy = adminUserId;
            review.remarks = REVIEW_DELETE_REMARKS.BY_ADMIN;
            reviewService.addHistory(review, { action: REVIEW_HISTORY_ACTIONS.DELETED, by: adminUserId, byRole: 'admin' });
            await review.save();
            productIds.add(review.productId.toString());
        }
        for (const id of productIds) {
            await reviewService.refreshProductReviewData(vendorId, id);
        }

        const skipped = reviewIds.length - reviews.length;
        return common.returnResult(true, 200,
            reviewIds.length === 1 ? 'Review deleted successfully.' : `${pluralReviews(reviews.length)} deleted.${skipped ? ` ${skipped} skipped (already deleted).` : ''}`,
            { deletedCount: reviews.length, skippedCount: skipped });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getAdminPermissions,
    listReviews,
    getReviewDetail,
    updateReview,
    approveReviews,
    rejectReviews,
    deleteReviews
};
