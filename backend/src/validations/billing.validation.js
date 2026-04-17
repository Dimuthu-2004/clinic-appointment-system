const { body, param } = require('express-validator');

const billingIdValidation = [param('id').isMongoId().withMessage('Invalid billing id')];

const createBillingValidation = [
  body('appointment').optional({ values: 'falsy' }).isMongoId().withMessage('Appointment must be a valid id'),
  body('patient').isMongoId().withMessage('Patient is required'),
  body('doctor').optional().isMongoId().withMessage('Doctor must be a valid id'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('currency').optional().trim().notEmpty(),
  body('status')
    .optional()
    .isIn(['pending', 'paid', 'cancelled', 'refunded'])
    .withMessage('Billing status is invalid'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card'])
    .withMessage('Finance can only confirm cash or card payments'),
  body('dueDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid due date'),
  body('notes').optional().isString(),
];

const updateBillingValidation = [
  ...billingIdValidation,
  body('appointment').optional({ values: 'falsy' }).isMongoId().withMessage('Appointment must be a valid id'),
  body('patient').optional().isMongoId().withMessage('Patient must be a valid id'),
  body('doctor').optional().isMongoId().withMessage('Doctor must be a valid id'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('currency').optional().trim().notEmpty(),
  body('status')
    .optional()
    .isIn(['pending', 'paid', 'cancelled', 'refunded'])
    .withMessage('Billing status is invalid'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card'])
    .withMessage('Finance can only confirm cash or card payments'),
  body('dueDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid due date'),
  body('notes').optional().isString(),
];

module.exports = {
  billingIdValidation,
  createBillingValidation,
  updateBillingValidation,
};
