const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const reviewAdminController = require('../controllers/reviewAdminController');
const checkModuleAssigned = require('../middlewares/checkModuleAssigned');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const createMemoryUploader = require('../middlewares/multer/memoryFileUpload');
const { MAX_REVIEW_IMAGES_HARD_LIMIT, REVIEWS_MODULE_CODE } = require('../constants/reviewConstants');
const {
    createReviewSchema,
    updateReviewSchema,
    reviewIdBodySchema,
    productIdParamSchema,
    orderIdParamSchema,
    reviewIdParamSchema,
    listReviewsQuerySchema,
    adminListReviewsQuerySchema,
    reviewIdsBodySchema,
    rejectReviewsSchema,
    adminUpdateReviewSchema
} = require('../middlewares/validations/reviewValidations');

// Photos come as the `images` files of a multipart form. 10MB is only the
// outer ceiling - each photo is checked against the vendor's own
// CompanyMaster.allowedReviewImageMB / allowedReviewImagesFormat /
// maxImagesPerReview in reviewService.
const reviewImageUpload = createMemoryUploader({ maxSizeMB: 10 }).array('images', MAX_REVIEW_IMAGES_HARD_LIMIT);

const customerAccess = [authenticate, authorize('user')];
// Admin Reviews module. Edit / approve / reject are further gated by their
// switches inside reviewAdminService; delete is always allowed.
const adminAccess = [authenticate, authorize('admin'), checkModuleAssigned(REVIEWS_MODULE_CODE)];

// Static paths first - '/:reviewId' would otherwise swallow them.
router.get('/settings', reviewController.getReviewSettings);
router.get('/product/:productId', validate(productIdParamSchema, 'params'), validate(listReviewsQuerySchema, 'query'), reviewController.getReviewsByProduct);
router.get('/product/:productId/my-status', ...customerAccess, validate(productIdParamSchema, 'params'), reviewController.getMyProductReviewStatus);
router.get('/my-order/:orderId', ...customerAccess, validate(orderIdParamSchema, 'params'), reviewController.getMyOrderReviewStatus);

router.post('/', ...customerAccess, reviewImageUpload, validate(createReviewSchema, 'body'), reviewController.createReview);
router.put('/', ...customerAccess, reviewImageUpload, validate(updateReviewSchema, 'body'), reviewController.updateReview);
router.delete('/', ...customerAccess, validate(reviewIdBodySchema, 'body'), reviewController.deleteReview);

// Admin - all before '/:reviewId'.
router.get('/admin/list', ...adminAccess, validate(adminListReviewsQuerySchema, 'query'), reviewAdminController.listReviews);
router.get('/admin/detail/:reviewId', ...adminAccess, validate(reviewIdParamSchema, 'params'), reviewAdminController.getReviewDetail);
router.put('/admin/update', ...adminAccess, reviewImageUpload, validate(adminUpdateReviewSchema, 'body'), reviewAdminController.updateReview);
router.post('/admin/approve', ...adminAccess, validate(reviewIdsBodySchema, 'body'), reviewAdminController.approveReviews);
router.post('/admin/reject', ...adminAccess, validate(rejectReviewsSchema, 'body'), reviewAdminController.rejectReviews);
router.post('/admin/bulk-delete', ...adminAccess, validate(reviewIdsBodySchema, 'body'), reviewAdminController.deleteReviews);
router.delete('/admin', ...adminAccess, validate(reviewIdBodySchema, 'body'), reviewAdminController.deleteReview);

router.get('/:reviewId', validate(reviewIdParamSchema, 'params'), reviewController.getReviewById);

module.exports = router;
