const express = require('express');
const reviewController = require('../controllers/review.controller');
const { protect } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validate.middleware');
const {
  reviewIdValidation,
  createReviewValidation,
  updateReviewValidation,
} = require('../validations/review.validation');

const router = express.Router();

router.get('/public', reviewController.getPublicReviews);

router
  .route('/')
  .get(protect, reviewController.getReviews)
  .post(protect, createReviewValidation, validateRequest, reviewController.createReview);

router
  .route('/:id')
  .get(protect, reviewIdValidation, validateRequest, reviewController.getReviewById)
  .put(protect, updateReviewValidation, validateRequest, reviewController.updateReview)
  .delete(protect, reviewIdValidation, validateRequest, reviewController.deleteReview);

module.exports = router;
