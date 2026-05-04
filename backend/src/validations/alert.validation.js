const { body, param } = require('express-validator');

const alertIdValidation = [param('id').isMongoId().withMessage('Invalid alert id')];

const ageRangeValidation = body().custom((_, { req }) => {
  const parseAge = (value) => {
    if (value === '' || value === null || value === undefined) {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : Number.NaN;
  };

  const minAge = parseAge(req.body.minAge);
  const maxAge = parseAge(req.body.maxAge);

  if (Number.isNaN(minAge)) {
    throw new Error('Minimum age must be a valid number');
  }

  if (Number.isNaN(maxAge)) {
    throw new Error('Maximum age must be a valid number');
  }

  if (minAge !== null && minAge < 0) {
    throw new Error('Minimum age cannot be negative');
  }

  if (maxAge !== null && maxAge <= 0) {
    throw new Error('Maximum age must be greater than 0');
  }

  if (maxAge !== null && maxAge > 120) {
    throw new Error('Maximum age cannot be more than 120');
  }

  if (minAge !== null && maxAge !== null && minAge >= maxAge) {
    throw new Error('Minimum age must be less than maximum age');
  }

  return true;
});

const selectedPatientsValidation = body('selectedPatientIds')
  .optional()
  .isArray()
  .withMessage('Selected patient list must be an array');

const selectedPatientsItemValidation = body('selectedPatientIds.*')
  .optional()
  .isMongoId()
  .withMessage('Selected patient id is invalid');

const createAlertValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('expiresAt')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Closing date and time must be valid'),
  body('sendToAll').optional().isBoolean().withMessage('Send to all users must be true or false'),
  body('sendEmailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be true or false'),
  body('minAge').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Minimum age must be 0 or more'),
  body('maxAge').optional({ values: 'falsy' }).isInt({ min: 1, max: 120 }).withMessage('Maximum age must be between 1 and 120'),
  body('targetCondition')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Target condition must be 120 characters or fewer'),
  body('status')
    .optional()
    .isIn(['active', 'archived'])
    .withMessage('Alert status is invalid'),
  selectedPatientsValidation,
  selectedPatientsItemValidation,
  ageRangeValidation,
];

const previewAlertValidation = [
  body('sendToAll').optional().isBoolean().withMessage('Send to all users must be true or false'),
  body('minAge').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Minimum age must be 0 or more'),
  body('maxAge').optional({ values: 'falsy' }).isInt({ min: 1, max: 120 }).withMessage('Maximum age must be between 1 and 120'),
  body('targetCondition')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Target condition must be 120 characters or fewer'),
  ageRangeValidation,
];

const updateAlertValidation = [
  ...alertIdValidation,
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('message').optional().trim().notEmpty().withMessage('Message cannot be empty'),
  body('expiresAt')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Closing date and time must be valid'),
  body('sendToAll').optional().isBoolean().withMessage('Send to all users must be true or false'),
  body('sendEmailNotifications')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be true or false'),
  body('minAge').optional({ values: 'falsy' }).isInt({ min: 0 }).withMessage('Minimum age must be 0 or more'),
  body('maxAge').optional({ values: 'falsy' }).isInt({ min: 1, max: 120 }).withMessage('Maximum age must be between 1 and 120'),
  body('targetCondition')
    .optional()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Target condition must be 120 characters or fewer'),
  body('status')
    .optional()
    .isIn(['active', 'archived'])
    .withMessage('Alert status is invalid'),
  selectedPatientsValidation,
  selectedPatientsItemValidation,
  ageRangeValidation,
];

module.exports = {
  alertIdValidation,
  createAlertValidation,
  previewAlertValidation,
  updateAlertValidation,
};
