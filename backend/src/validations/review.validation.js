const { body, param } = require('express-validator');

const reviewIdValidation = [param('id').isMongoId().withMessage('Invalid review id')];

const createReviewValidation = [
  body('appointment').isMongoId().withMessage('Appointment is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment')
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Feedback should be between 5 and 1000 characters'),
];

const updateReviewValidation = [
  ...reviewIdValidation,
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .trim()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Feedback should be between 5 and 1000 characters'),
  body('adminReply')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Reply must be 1000 characters or fewer'),
];

module.exports = {
  reviewIdValidation,
  createReviewValidation,
  updateReviewValidation,
};
