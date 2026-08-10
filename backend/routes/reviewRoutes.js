const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { createReviewSchema, updateReviewSchema, listReviewsQuerySchema } = require('../validators/reviewValidation');

router.get('/product/:productId', validate(listReviewsQuerySchema, 'query'), reviewController.getReviewsByProduct);
router.get('/:reviewId', reviewController.getReviewById);

router.post('/', authenticate, authorize('user'), validate(createReviewSchema, 'body'), reviewController.createReview);
router.put('/', authenticate, authorize('user'), validate(updateReviewSchema, 'body'), reviewController.updateReview);
router.delete('/', authenticate, authorize('user'), reviewController.deleteReview);

router.delete('/admin', authenticate, authorize('admin'), reviewController.adminDeleteReview);

module.exports = router;