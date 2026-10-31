// Product reviews - shared by the Review model, reviewValidations.js,
// reviewService.js and the review image uploader.

// ImageAsset.module for review photos.
const REVIEW_IMAGE_MODULE = 'review';

// Hard ceiling on photos per review. CompanyMaster.maxImagesPerReview is the
// vendor's real limit (1-10); multer needs a fixed number up front, so it is
// given this one and the service checks the vendor's own.
const MAX_REVIEW_IMAGES_HARD_LIMIT = 10;

// Upper bound for CompanySettings.maxReviewsPerCustomerPerProduct (null = no limit).
const MAX_REVIEWS_PER_CUSTOMER_PER_PRODUCT = 100;

const REVIEW_TITLE_MAX_LENGTH = 120;
const REVIEW_COMMENT_MAX_LENGTH = 3000;

// Storefront list: sort options and page size.
const REVIEW_SORTS = {
    RECENT: 'recent',
    HIGHEST: 'highest',
    LOWEST: 'lowest',
    WITH_IMAGES: 'withImages'
};
const VALID_REVIEW_SORTS = Object.values(REVIEW_SORTS);
const DEFAULT_REVIEW_PAGE_SIZE = 10;
const MAX_REVIEW_PAGE_SIZE = 50;

// Review.remarks - why a review was deleted.
const REVIEW_DELETE_REMARKS = {
    BY_USER: 'Deleted By User',
    BY_ADMIN: 'Deleted By Admin'
};
const VALID_REVIEW_DELETE_REMARKS = Object.values(REVIEW_DELETE_REMARKS);

// How long a product's rating summary stays cached (seconds). Every review
// create/update/delete clears it straight away.
const REVIEW_SUMMARY_CACHE_TTL = 300;

// Review.moderationStatus - the state of the customer's CURRENT content.
//   APPROVED - current content is the published one (or will be once saved).
//   PENDING  - waiting for the admin (approve/reject switch on). A review
//              that was approved before keeps its old published version
//              live meanwhile.
//   REJECTED - a new review the admin rejected: hidden from everyone,
//              including the customer. (Rejecting an EDIT of an approved
//              review restores the published version and goes back to APPROVED.)
const REVIEW_MODERATION_STATUSES = {
    APPROVED: 'APPROVED',
    PENDING: 'PENDING',
    REJECTED: 'REJECTED'
};
const VALID_REVIEW_MODERATION_STATUSES = Object.values(REVIEW_MODERATION_STATUSES);

// Review.history[].action
const REVIEW_HISTORY_ACTIONS = {
    CUSTOMER_EDIT: 'CUSTOMER_EDIT',
    ADMIN_EDIT: 'ADMIN_EDIT',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    EDIT_REJECTED: 'EDIT_REJECTED',
    AUTO_APPROVED: 'AUTO_APPROVED',
    DELETED: 'DELETED'
};
const VALID_REVIEW_HISTORY_ACTIONS = Object.values(REVIEW_HISTORY_ACTIONS);

const REVIEW_REJECTION_REASON_MAX_LENGTH = 500;

// Admin list (Reviews module).
const ADMIN_REVIEW_FILTER_STATUSES = {
    ALL: 'all',
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    DELETED: 'deleted'
};
const VALID_ADMIN_REVIEW_FILTER_STATUSES = Object.values(ADMIN_REVIEW_FILTER_STATUSES);
const ADMIN_REVIEW_SORTS = {
    PENDING_FIRST: 'pendingFirst',
    NEWEST: 'newest',
    OLDEST: 'oldest',
    HIGHEST: 'highest',
    LOWEST: 'lowest'
};
const VALID_ADMIN_REVIEW_SORTS = Object.values(ADMIN_REVIEW_SORTS);
const DEFAULT_ADMIN_REVIEW_PAGE_SIZE = 20;
const MAX_ADMIN_REVIEW_PAGE_SIZE = 100;
const MAX_BULK_REVIEW_IDS = 100;
const ADMIN_REVIEW_SEARCH_MAX_LENGTH = 100;

// Realtime (shared 'admin:notification' event, told apart by `module`).
const REALTIME_MODULE_REVIEWS = 'REVIEWS';
const REVIEW_NOTIFICATION_TYPES = {
    NEW: 'NEW',               // a customer posted a review
    UPDATED: 'UPDATED',       // a customer edited their review
    DELETED: 'DELETED'        // a customer deleted their review
};

// ModuleMaster.code of the admin Reviews module.
const REVIEWS_MODULE_CODE = 'REVIEWS';

module.exports = {
    REVIEW_MODERATION_STATUSES,
    VALID_REVIEW_MODERATION_STATUSES,
    REVIEW_HISTORY_ACTIONS,
    VALID_REVIEW_HISTORY_ACTIONS,
    REVIEW_REJECTION_REASON_MAX_LENGTH,
    ADMIN_REVIEW_FILTER_STATUSES,
    VALID_ADMIN_REVIEW_FILTER_STATUSES,
    ADMIN_REVIEW_SORTS,
    VALID_ADMIN_REVIEW_SORTS,
    DEFAULT_ADMIN_REVIEW_PAGE_SIZE,
    MAX_ADMIN_REVIEW_PAGE_SIZE,
    MAX_BULK_REVIEW_IDS,
    ADMIN_REVIEW_SEARCH_MAX_LENGTH,
    REALTIME_MODULE_REVIEWS,
    REVIEW_NOTIFICATION_TYPES,
    REVIEWS_MODULE_CODE,
    REVIEW_IMAGE_MODULE,
    MAX_REVIEW_IMAGES_HARD_LIMIT,
    MAX_REVIEWS_PER_CUSTOMER_PER_PRODUCT,
    REVIEW_TITLE_MAX_LENGTH,
    REVIEW_COMMENT_MAX_LENGTH,
    REVIEW_SORTS,
    VALID_REVIEW_SORTS,
    DEFAULT_REVIEW_PAGE_SIZE,
    MAX_REVIEW_PAGE_SIZE,
    REVIEW_DELETE_REMARKS,
    VALID_REVIEW_DELETE_REMARKS,
    REVIEW_SUMMARY_CACHE_TTL
};
