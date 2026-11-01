const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const redisService = require('./redisService');
const imageUploadService = require('./imageUploadService');
const reviewRealtimeService = require('./reviewRealtimeService');
const redisKeys = require('../utils/redisKeys');
const common = require('../utils/common');
const logger = require('../utils/logger');
const {
    REVIEW_IMAGE_MODULE,
    REVIEW_SORTS,
    REVIEW_DELETE_REMARKS,
    REVIEW_SUMMARY_CACHE_TTL,
    REVIEW_MODERATION_STATUSES,
    REVIEW_HISTORY_ACTIONS,
    REVIEW_NOTIFICATION_TYPES
} = require('../constants/reviewConstants');

// How a review is stored (see models/Review.js):
//   rating/title/comment/images - the CURRENT content: what the customer sees
//                                 as their own review and what the admin edits.
//   publishedContent            - what every other shopper sees (null = not public).
// With the approve/reject switch off every save publishes straight away, so
// the two are always the same. With it on, a customer's new review or edit
// waits (PENDING) until the admin approves it; until then an earlier approved
// version (if any) stays live.

// ---------------------------------------------------------------------------
// Feature switches
// ---------------------------------------------------------------------------

// Reviews are on only while BOTH WebsiteMaster and CompanyMaster have
// isProductReviewFeatureOn. Writing, editing, deleting AND viewing all stop
// when either one is off.
const checkReviewFeature = async (vendorId, websiteMasterData, companyMasterData) => {
    try {
        return await common.checkFeatureOnOrOff(
            vendorId,
            websiteMasterData || {},
            companyMasterData || {},
            'isProductReviewFeatureOn',
            'isProductReviewFeatureOn'
        );
    } catch (err) {
        throw err;
    }
};

// Viewing also needs the vendor's own "Show reviews to customers" setting.
const checkReviewVisibility = async (vendorId, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const featureCheck = await checkReviewFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return featureCheck;
        }
        if (companySettingsData && companySettingsData.showReviewsToCustomers === false) {
            return common.returnResult(false, 403, 'Reviews are not available for this store.');
        }
        return common.returnResult(true, 200, 'Reviews are visible');
    } catch (err) {
        throw err;
    }
};

const isOnInBoth = (websiteMasterData, companyMasterData, field) => {
    try {
        return !!(websiteMasterData?.[field] && companyMasterData?.[field]);
    } catch (err) {
        throw err;
    }
};

// The admin Reviews module's switches (each also needs reviews themselves on).
const getModerationFlags = (websiteMasterData, companyMasterData) => {
    try {
        const reviewsOn = isOnInBoth(websiteMasterData, companyMasterData, 'isProductReviewFeatureOn');
        return {
            approvalOn: reviewsOn && isOnInBoth(websiteMasterData, companyMasterData, 'isReviewApproveRejectFeatureOn'),
            editingOn: reviewsOn && isOnInBoth(websiteMasterData, companyMasterData, 'isReviewEditingFeatureOn')
        };
    } catch (err) {
        throw err;
    }
};

// Photos on reviews: both halves of isIncludingImageInReviewsAllowed (and
// reviews themselves) must be on.
const areReviewImagesAllowed = (websiteMasterData, companyMasterData) => {
    try {
        return isOnInBoth(websiteMasterData, companyMasterData, 'isIncludingImageInReviewsAllowed');
    } catch (err) {
        throw err;
    }
};

const getMaxImagesPerReview = (companyMasterData) => {
    try {
        const max = Number(companyMasterData?.maxImagesPerReview);
        return Number.isInteger(max) && max > 0 ? max : 5;
    } catch (err) {
        throw err;
    }
};

// CompanySettings.maxReviewsPerCustomerPerProduct - null = no limit. A
// vendor who has not saved settings yet gets the schema default of 1.
const getMaxReviewsPerCustomer = (companySettingsData) => {
    try {
        if (!companySettingsData || companySettingsData.maxReviewsPerCustomerPerProduct === undefined) return 1;
        return companySettingsData.maxReviewsPerCustomerPerProduct;
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------------
// Content / publishing helpers (shared with reviewAdminService)
// ---------------------------------------------------------------------------

const copyImages = (images) => {
    try {
        return (images || []).map((image) => ({
            _id: image._id,
            url: image.url,
            imageAssetId: image.imageAssetId || null
        }));
    } catch (err) {
        throw err;
    }
};

// A plain copy of the review's current content.
const snapshotContent = (review) => {
    try {
        return {
            rating: review.rating,
            title: review.title || '',
            comment: review.comment || '',
            images: copyImages(review.images)
        };
    } catch (err) {
        throw err;
    }
};

// Makes the current content the public one.
const publishCurrentContent = (review, now = new Date()) => {
    try {
        review.publishedContent = snapshotContent(review);
        if (!review.publishedAt) review.publishedAt = now;
        review.moderationStatus = REVIEW_MODERATION_STATUSES.APPROVED;
    } catch (err) {
        throw err;
    }
};

const addHistory = (review, entry) => {
    try {
        review.history.push({ at: new Date(), before: null, after: null, reason: null, ...entry });
    } catch (err) {
        throw err;
    }
};

// Public (other shoppers) filter: live and published.
const publishedFilter = (vendorId, productId) => {
    try {
        return { vendorId, productId, status: 'A', publishedContent: { $ne: null } };
    } catch (err) {
        throw err;
    }
};

// Recomputes Product.averageRating / totalReviews from the PUBLISHED reviews.
// timestamps:false - a new review must not look like a product edit.
const recalcProductRatingAggregate = async (vendorId, productId) => {
    try {
        const stats = await Review.aggregate([
            {
                $match: {
                    vendorId: new mongoose.Types.ObjectId(vendorId),
                    productId: new mongoose.Types.ObjectId(productId),
                    status: 'A',
                    publishedContent: { $ne: null }
                }
            },
            { $group: { _id: null, avgRating: { $avg: '$publishedContent.rating' }, count: { $sum: 1 } } }
        ]);

        const count = stats.length ? stats[0].count : 0;
        const averageRating = count ? Math.round(stats[0].avgRating * 10) / 10 : 0;

        await Product.updateOne(
            { _id: productId, vendorId },
            { $set: { averageRating, totalReviews: count } },
            { timestamps: false }
        );
    } catch (err) {
        throw err;
    }
};

// After any change to what is published: new rating summary + drop the cached one.
const refreshProductReviewData = async (vendorId, productId) => {
    try {
        await recalcProductRatingAggregate(vendorId, productId);
        await redisService.del(redisKeys.reviewSummary(vendorId, productId));
    } catch (err) {
        throw err;
    }
};

// With the approve/reject switch OFF nothing may stay waiting: reviews (and
// edits) left PENDING from when it was on go live now. Called from the places
// that read reviews; a cheap indexed check when there is nothing to do.
// Rejected reviews stay hidden.
const settlePendingReviews = async ({ vendorId, websiteMasterData, companyMasterData, productId = null }) => {
    try {
        if (getModerationFlags(websiteMasterData, companyMasterData).approvalOn) return 0;

        const filter = { vendorId, status: 'A', moderationStatus: REVIEW_MODERATION_STATUSES.PENDING };
        if (productId) filter.productId = productId;
        if (!(await Review.exists(filter))) return 0;

        const pending = await Review.find(filter);
        const productIds = new Set();
        const now = new Date();
        for (const review of pending) {
            const before = review.publishedContent ? review.publishedContent.toObject() : null;
            publishCurrentContent(review, now);
            addHistory(review, {
                action: REVIEW_HISTORY_ACTIONS.AUTO_APPROVED,
                by: null,
                byRole: 'system',
                before,
                after: snapshotContent(review)
            });
            await review.save();
            productIds.add(review.productId.toString());
        }
        for (const id of productIds) {
            await refreshProductReviewData(vendorId, id);
        }
        return pending.length;
    } catch (err) {
        throw err;
    }
};

// Uploads review photos to the vendor's storage account. Stops at the first
// failure; the caller removes whatever was already uploaded.
const uploadReviewImages = async ({ vendorId, userId, files, companyMasterData, websiteMasterData, uploaded }) => {
    try {
        for (const file of files) {
            const uploadResult = await imageUploadService.uploadImage({
                vendorId,
                module: REVIEW_IMAGE_MODULE,
                file,
                userId,
                maxSizeField: 'allowedReviewImageMB',
                allowedFormatsField: 'allowedReviewImagesFormat',
                companyMasterData,
                websiteMasterData
            });
            if (!uploadResult.isSuccess) {
                return common.returnResult(false, uploadResult.statusCode, `${file.originalname}: ${uploadResult.message}`);
            }
            const imageAsset = uploadResult.meta.image;
            uploaded.push({ _id: new mongoose.Types.ObjectId(), url: imageAsset.url, imageAssetId: imageAsset._id });
        }
        return common.returnResult(true, 200, 'Images uploaded');
    } catch (err) {
        throw err;
    }
};

// Best effort: removes freshly uploaded photos whose review could not be
// saved. (Photos taken off a saved review are kept on purpose - the published
// version or the review's history may still show them.)
const removeReviewImages = async (images, userId) => {
    try {
        for (const image of images) {
            if (!image.imageAssetId) continue;
            try {
                const deleteResult = await imageUploadService.deleteImage({ imageId: image.imageAssetId, userId });
                if (!deleteResult.isSuccess) {
                    logger.logWarning('reviewService - removeReviewImages: image could not be deleted', { imageAssetId: image.imageAssetId, message: deleteResult.message });
                }
            } catch (deleteErr) {
                logger.logWarning('reviewService - removeReviewImages: Exception while deleting a review image', { imageAssetId: image.imageAssetId, error: deleteErr });
            }
        }
    } catch (err) {
        throw err;
    }
};

// Shared photo checks for create and update. `enforceCustomerSwitch` false
// for the admin, who may add photos even while customers can't.
const checkImageRules = (files, existingCount, websiteMasterData, companyMasterData, enforceCustomerSwitch = true) => {
    try {
        if (!files.length) return common.returnResult(true, 200, 'No images');
        if (enforceCustomerSwitch && !areReviewImagesAllowed(websiteMasterData, companyMasterData)) {
            return common.returnResult(false, 403, 'Adding photos to reviews is not available for this store.');
        }
        const maxImages = getMaxImagesPerReview(companyMasterData);
        if (existingCount + files.length > maxImages) {
            return common.returnResult(false, 400, `A review can have at most ${maxImages} photo${maxImages === 1 ? '' : 's'}.`);
        }
        return common.returnResult(true, 200, 'Images allowed');
    } catch (err) {
        throw err;
    }
};

// Resolves the photos a review keeps after `removeImageIds`, or an error
// result when one of them isn't on the review.
const resolveKeptImages = (review, removeImageIds) => {
    try {
        const removeSet = new Set((removeImageIds || []).map(String));
        const unknownImage = [...removeSet].find((id) => !review.images.some((image) => image._id.toString() === id));
        if (unknownImage) {
            return { error: common.returnResult(false, 400, 'One of the photos to remove is not on this review.') };
        }
        return { kept: review.images.filter((image) => !removeSet.has(image._id.toString())) };
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------------
// Storefront settings
// ---------------------------------------------------------------------------

// What the storefront needs to know before showing any review UI. Also the
// one call every storefront page makes - so it settles reviews left pending
// after the approve/reject switch was turned off.
const getReviewSettings = async (vendorId, websiteMasterData, companyMasterData, companySettingsData) => {
    try {
        const featureCheck = await checkReviewFeature(vendorId, websiteMasterData, companyMasterData);
        const isEnabled = featureCheck.isSuccess;
        const imagesAllowed = isEnabled && areReviewImagesAllowed(websiteMasterData, companyMasterData);

        if (isEnabled) {
            await settlePendingReviews({ vendorId, websiteMasterData, companyMasterData });
        }

        return common.returnResult(true, 200, 'Review settings fetched successfully', {
            settings: {
                isEnabled,
                showReviews: isEnabled && companySettingsData?.showReviewsToCustomers !== false,
                imagesAllowed,
                maxImagesPerReview: imagesAllowed ? getMaxImagesPerReview(companyMasterData) : 0,
                maxImageSizeMB: imagesAllowed ? (companyMasterData?.allowedReviewImageMB ?? null) : null,
                allowedImageFormats: imagesAllowed ? (companyMasterData?.allowedReviewImagesFormat || []) : [],
                maxReviewsPerCustomerPerProduct: getMaxReviewsPerCustomer(companySettingsData)
            }
        });
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// A delivered (and not since cancelled/restarted) order of this customer that
// contains the product. deliveredAt is set when the order reaches the
// DELIVERED step and cleared again if the order is restarted.
const findDeliveredOrderWithProduct = async (vendorId, userId, orderId, productId) => {
    try {
        return await Order.findOne({
            _id: orderId,
            vendorId,
            userId,
            status: 'A',
            deliveredAt: { $ne: null },
            cancelledAt: null,
            'items.productId': productId
        }).select('_id orderNumber deliveredAt items');
    } catch (err) {
        throw err;
    }
};

const pickOrderItem = (order, productId) => {
    try {
        return (order.items || []).find((item) => item.productId && item.productId.toString() === productId.toString()) || null;
    } catch (err) {
        throw err;
    }
};

// Every live review of the customer counts toward the limit - a rejected one too.
const countLiveReviewsByCustomer = async (vendorId, userId, productId) => {
    try {
        return await Review.countDocuments({ vendorId, userId, productId, status: 'A' });
    } catch (err) {
        throw err;
    }
};

// The customer's own reviews they can see: rejected ones are hidden from them too.
const visibleToOwnerFilter = (vendorId, userId) => {
    try {
        return { vendorId, userId, status: 'A', moderationStatus: { $ne: REVIEW_MODERATION_STATUSES.REJECTED } };
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------------
// Customer: write / edit / delete
// ---------------------------------------------------------------------------

const createReview = async ({
    vendorId,
    userId,
    websiteMasterData,
    companyMasterData,
    companySettingsData,
    productId,
    orderId,
    rating,
    title,
    comment,
    files = []
}) => {
    try {
        const featureCheck = await checkReviewFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const product = await Product.findOne({ _id: productId, vendorId, status: { $in: ['A', 'I'] } }).select('_id name');
        if (!product) {
            return common.returnResult(false, 404, 'Product not found.');
        }

        const order = await findDeliveredOrderWithProduct(vendorId, userId, orderId, productId);
        if (!order) {
            return common.returnResult(false, 403, 'You can review this product once an order containing it has been delivered to you.');
        }

        // Any live review for this order blocks a new one - a rejected one too
        // (the customer is never told it was rejected).
        const existingForOrder = await Review.findOne({ vendorId, productId, userId, orderId: order._id, status: { $in: ['A', 'I'] } }).select('_id');
        if (existingForOrder) {
            return common.returnResult(false, 409, 'You have already reviewed this product for this order. You can edit your review instead.');
        }

        const maxReviews = getMaxReviewsPerCustomer(companySettingsData);
        if (maxReviews !== null) {
            const myReviewCount = await countLiveReviewsByCustomer(vendorId, userId, productId);
            if (myReviewCount >= maxReviews) {
                return common.returnResult(false, 409, maxReviews === 1
                    ? 'You have already reviewed this product.'
                    : `You can write at most ${maxReviews} reviews for this product.`);
            }
        }

        const imageCheck = checkImageRules(files, 0, websiteMasterData, companyMasterData);
        if (!imageCheck.isSuccess) {
            return imageCheck;
        }

        // Uploads happen before the review exists - anything uploaded is
        // removed again unless the review was saved.
        const uploadedImages = [];
        let saved = false;
        try {
            if (files.length) {
                const uploadResult = await uploadReviewImages({ vendorId, userId, files, companyMasterData, websiteMasterData, uploaded: uploadedImages });
                if (!uploadResult.isSuccess) {
                    return uploadResult;
                }
            }

            const item = pickOrderItem(order, productId);
            const review = new Review({
                vendorId,
                productId,
                orderId: order._id,
                variantId: item?.variantId || null,
                sizeId: item?.sizeId || null,
                variantName: item?.variantName || null,
                sizeName: item?.sizeName || null,
                userId,
                rating,
                title: title || '',
                comment: comment || '',
                images: uploadedImages,
                isVerifiedPurchase: true,
                createdBy: userId
            });
            review.originalContent = snapshotContent(review);

            // Approve/reject on: only the customer sees it until the admin approves it.
            if (getModerationFlags(websiteMasterData, companyMasterData).approvalOn) {
                review.moderationStatus = REVIEW_MODERATION_STATUSES.PENDING;
            } else {
                publishCurrentContent(review);
            }

            await review.save();
            saved = true;

            if (review.publishedContent) {
                await refreshProductReviewData(vendorId, productId);
            }
            reviewRealtimeService.notifyReviewChanged(review, REVIEW_NOTIFICATION_TYPES.NEW, { productName: product.name });

            // Same message either way - the customer is not told about moderation.
            return common.returnResult(true, 201, 'Thank you! Your review has been posted.', { review });
        } finally {
            if (!saved && uploadedImages.length) {
                await removeReviewImages(uploadedImages, userId);
            }
        }
    } catch (err) {
        throw err;
    }
};

const updateReview = async ({
    vendorId,
    userId,
    websiteMasterData,
    companyMasterData,
    reviewId,
    updates,
    removeImageIds = [],
    files = []
}) => {
    try {
        const featureCheck = await checkReviewFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        // A rejected review is hidden from its customer too - so "not found".
        const review = await Review.findOne({ _id: reviewId, ...visibleToOwnerFilter(vendorId, userId) });
        if (!review) {
            return common.returnResult(false, 404, 'Review not found.');
        }

        const keptResult = resolveKeptImages(review, removeImageIds);
        if (keptResult.error) {
            return keptResult.error;
        }

        const imageCheck = checkImageRules(files, keptResult.kept.length, websiteMasterData, companyMasterData);
        if (!imageCheck.isSuccess) {
            return imageCheck;
        }

        const uploadedImages = [];
        let saved = false;
        try {
            if (files.length) {
                const uploadResult = await uploadReviewImages({ vendorId, userId, files, companyMasterData, websiteMasterData, uploaded: uploadedImages });
                if (!uploadResult.isSuccess) {
                    return uploadResult;
                }
            }

            const before = snapshotContent(review);
            if (updates.rating !== undefined) review.rating = updates.rating;
            if (updates.title !== undefined) review.title = updates.title;
            if (updates.comment !== undefined) review.comment = updates.comment;
            review.images = [...copyImages(keptResult.kept), ...uploadedImages];
            review.updatedBy = userId;

            // Approve/reject on: the edit waits for the admin; an approved
            // version stays live meanwhile. Off: the edit goes live now.
            if (getModerationFlags(websiteMasterData, companyMasterData).approvalOn) {
                review.moderationStatus = REVIEW_MODERATION_STATUSES.PENDING;
            } else {
                publishCurrentContent(review);
            }
            addHistory(review, {
                action: REVIEW_HISTORY_ACTIONS.CUSTOMER_EDIT,
                by: userId,
                byRole: 'user',
                before,
                after: snapshotContent(review)
            });

            await review.save();
            saved = true;

            await refreshProductReviewData(vendorId, review.productId);
            reviewRealtimeService.notifyReviewChanged(review, REVIEW_NOTIFICATION_TYPES.UPDATED);

            return common.returnResult(true, 200, 'Your review has been updated.', { review });
        } finally {
            if (!saved && uploadedImages.length) {
                await removeReviewImages(uploadedImages, userId);
            }
        }
    } catch (err) {
        throw err;
    }
};

const deleteReview = async ({ vendorId, userId, websiteMasterData, companyMasterData, reviewId }) => {
    try {
        const featureCheck = await checkReviewFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const review = await Review.findOne({ _id: reviewId, ...visibleToOwnerFilter(vendorId, userId) });
        if (!review) {
            return common.returnResult(false, 404, 'Review not found.');
        }

        review.status = 'D';
        review.deletedBy = userId;
        review.remarks = REVIEW_DELETE_REMARKS.BY_USER;
        addHistory(review, { action: REVIEW_HISTORY_ACTIONS.DELETED, by: userId, byRole: 'user' });
        await review.save();

        await refreshProductReviewData(vendorId, review.productId);
        reviewRealtimeService.notifyReviewChanged(review, REVIEW_NOTIFICATION_TYPES.DELETED);

        return common.returnResult(true, 200, 'Your review has been deleted.');
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------------
// Customer: what may I review?
// ---------------------------------------------------------------------------

// Product page: can this customer write a review now, and with which order?
const getMyProductReviewStatus = async ({ vendorId, userId, websiteMasterData, companyMasterData, companySettingsData, productId }) => {
    try {
        const featureCheck = await checkReviewFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const [deliveredOrders, allMyReviews] = await Promise.all([
            Order.find({
                vendorId,
                userId,
                status: 'A',
                deliveredAt: { $ne: null },
                cancelledAt: null,
                'items.productId': productId
            }).select('_id orderNumber deliveredAt items').sort({ deliveredAt: -1 }).lean(),
            Review.find({ vendorId, userId, productId, status: 'A' }).sort({ createdAt: -1 }).lean()
        ]);

        // Rejected reviews still use up their order and the limit, but the
        // customer never sees them.
        const myReviews = allMyReviews.filter((review) => review.moderationStatus !== REVIEW_MODERATION_STATUSES.REJECTED);
        const reviewedOrderIds = new Set(allMyReviews.map((review) => review.orderId.toString()));
        const eligibleOrders = deliveredOrders
            .filter((order) => !reviewedOrderIds.has(order._id.toString()))
            .map((order) => {
                const item = pickOrderItem(order, productId);
                return {
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    deliveredAt: order.deliveredAt,
                    variantName: item?.variantName || null,
                    sizeName: item?.sizeName || null
                };
            });

        const maxReviews = getMaxReviewsPerCustomer(companySettingsData);
        const remaining = maxReviews === null ? null : Math.max(0, maxReviews - allMyReviews.length);
        const canWrite = eligibleOrders.length > 0 && (remaining === null || remaining > 0);

        // NOT_PURCHASED: no delivered order with this product yet.
        // ALREADY_REVIEWED: every delivered order is reviewed, or the limit is reached.
        let reason = null;
        if (!canWrite) {
            reason = deliveredOrders.length === 0 ? 'NOT_PURCHASED' : 'ALREADY_REVIEWED';
        }

        return common.returnResult(true, 200, 'Review status fetched successfully', {
            canWrite,
            reason,
            remaining,
            eligibleOrders: canWrite ? eligibleOrders : [],
            myReviews
        });
    } catch (err) {
        throw err;
    }
};

// Order page: per product on this order, the customer's review (for this
// order, or - once the limit is reached - their latest one, to edit) and
// whether a new review can still be written from this order.
const getMyOrderReviewStatus = async ({ vendorId, userId, websiteMasterData, companyMasterData, companySettingsData, orderId }) => {
    try {
        const featureCheck = await checkReviewFeature(vendorId, websiteMasterData, companyMasterData);
        if (!featureCheck.isSuccess) {
            return common.returnResult(false, featureCheck.statusCode, featureCheck.message);
        }

        const order = await Order.findOne({ _id: orderId, vendorId, userId, status: 'A' }).select('_id deliveredAt cancelledAt items').lean();
        if (!order) {
            return common.returnResult(false, 404, 'Order not found.');
        }

        const isDelivered = !!order.deliveredAt && !order.cancelledAt;
        const productIds = [...new Set((order.items || []).map((item) => item.productId.toString()))];
        const allMyReviews = productIds.length
            ? await Review.find({ vendorId, userId, productId: { $in: productIds }, status: 'A' }).sort({ createdAt: -1 }).lean()
            : [];

        const maxReviews = getMaxReviewsPerCustomer(companySettingsData);
        const isVisible = (review) => review.moderationStatus !== REVIEW_MODERATION_STATUSES.REJECTED;
        const products = productIds.map((productId) => {
            const reviewsForProduct = allMyReviews.filter((review) => review.productId.toString() === productId);
            const reviewForThisOrder = reviewsForProduct.find((review) => review.orderId.toString() === order._id.toString()) || null;
            const limitReached = maxReviews !== null && reviewsForProduct.length >= maxReviews;
            const latestVisible = reviewsForProduct.find(isVisible) || null;
            let review = null;
            if (reviewForThisOrder) review = isVisible(reviewForThisOrder) ? reviewForThisOrder : null;
            else if (limitReached) review = latestVisible;
            return {
                productId,
                canWrite: isDelivered && !reviewForThisOrder && !limitReached,
                review
            };
        });

        return common.returnResult(true, 200, 'Order review status fetched successfully', { isDelivered, products });
    } catch (err) {
        throw err;
    }
};

// ---------------------------------------------------------------------------
// Storefront: read reviews (published versions only)
// ---------------------------------------------------------------------------

// Average, total, 5->1 star breakdown and how many have photos. Cached; every
// change to what is published clears it.
const getProductReviewSummary = async (vendorId, productId) => {
    try {
        return await redisService.getOrSet(redisKeys.reviewSummary(vendorId, productId), async () => {
            const [byRating, withImages] = await Promise.all([
                Review.aggregate([
                    {
                        $match: {
                            vendorId: new mongoose.Types.ObjectId(vendorId),
                            productId: new mongoose.Types.ObjectId(productId),
                            status: 'A',
                            publishedContent: { $ne: null }
                        }
                    },
                    { $group: { _id: '$publishedContent.rating', count: { $sum: 1 } } }
                ]),
                Review.countDocuments({ ...publishedFilter(vendorId, productId), 'publishedContent.images.0': { $exists: true } })
            ]);

            const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
            let total = 0;
            let ratingSum = 0;
            for (const row of byRating) {
                breakdown[row._id] = row.count;
                total += row.count;
                ratingSum += row._id * row.count;
            }

            return {
                averageRating: total ? Math.round((ratingSum / total) * 10) / 10 : 0,
                totalReviews: total,
                breakdown,
                withImagesCount: withImages
            };
        }, REVIEW_SUMMARY_CACHE_TTL);
    } catch (err) {
        throw err;
    }
};

const SORT_ORDERS = {
    [REVIEW_SORTS.RECENT]: { createdAt: -1 },
    [REVIEW_SORTS.HIGHEST]: { 'publishedContent.rating': -1, createdAt: -1 },
    [REVIEW_SORTS.LOWEST]: { 'publishedContent.rating': 1, createdAt: -1 },
    [REVIEW_SORTS.WITH_IMAGES]: { createdAt: -1 }
};

const getReviewsByProductId = async ({
    vendorId,
    websiteMasterData,
    companyMasterData,
    companySettingsData,
    productId,
    page,
    limit,
    sort,
    rating
}) => {
    try {
        const visibility = await checkReviewVisibility(vendorId, websiteMasterData, companyMasterData, companySettingsData);
        if (!visibility.isSuccess) {
            return common.returnResult(false, visibility.statusCode, visibility.message);
        }

        await settlePendingReviews({ vendorId, websiteMasterData, companyMasterData, productId });

        const filter = publishedFilter(vendorId, productId);
        if (rating) filter['publishedContent.rating'] = rating;
        if (sort === REVIEW_SORTS.WITH_IMAGES) filter['publishedContent.images.0'] = { $exists: true };

        const [summary, total, reviews] = await Promise.all([
            getProductReviewSummary(vendorId, productId),
            Review.countDocuments(filter),
            Review.find(filter)
                .select('-history -originalContent')
                .sort(SORT_ORDERS[sort] || SORT_ORDERS[REVIEW_SORTS.RECENT])
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('userId', 'name')
                .lean()
        ]);

        return common.returnResult(true, 200, 'Reviews fetched successfully', {
            summary,
            reviews,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            }
        });
    } catch (err) {
        throw err;
    }
};

const getReviewById = async ({ vendorId, websiteMasterData, companyMasterData, companySettingsData, reviewId }) => {
    try {
        const visibility = await checkReviewVisibility(vendorId, websiteMasterData, companyMasterData, companySettingsData);
        if (!visibility.isSuccess) {
            return common.returnResult(false, visibility.statusCode, visibility.message);
        }

        const review = await Review.findOne({ _id: reviewId, vendorId, status: 'A', publishedContent: { $ne: null } })
            .select('-history -originalContent')
            .populate('userId', 'name')
            .lean();
        if (!review) {
            return common.returnResult(false, 404, 'Review not found.');
        }
        return common.returnResult(true, 200, 'Review fetched successfully', { review });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getReviewSettings,
    createReview,
    updateReview,
    deleteReview,
    getMyProductReviewStatus,
    getMyOrderReviewStatus,
    getReviewsByProductId,
    getReviewById,
    // Shared with reviewAdminService.
    checkReviewFeature,
    getModerationFlags,
    getMaxImagesPerReview,
    snapshotContent,
    copyImages,
    publishCurrentContent,
    addHistory,
    refreshProductReviewData,
    settlePendingReviews,
    uploadReviewImages,
    removeReviewImages,
    checkImageRules,
    resolveKeptImages
};
