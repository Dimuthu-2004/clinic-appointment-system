const { body, param } = require('express-validator');

const prescriptionIdValidation = [param('id').isMongoId().withMessage('Invalid prescription id')];

const createPrescriptionValidation = [
  body('patient').isMongoId().withMessage('Patient is required'),
  body('appointment').optional({ values: 'falsy' }).isMongoId().withMessage('Appointment must be a valid id'),
  body('medications').isArray({ min: 1 }).withMessage('At least one medication is required'),
  body('medications.*.name').trim().notEmpty().withMessage('Medication name is required'),
  body('medications.*.dosage').trim().notEmpty().withMessage('Medication dosage is required'),
  body('medications.*.frequency').trim().notEmpty().withMessage('Medication frequency is required'),
  body('medications.*.duration').trim().notEmpty().withMessage('Medication duration is required'),
  body('medications.*.instructions').optional().isString(),
  body('notes').optional().isString(),
  body('status')
    .optional()
    .isIn(['active', 'completed', 'cancelled'])
    .withMessage('Prescription status is invalid'),
];

const updatePrescriptionValidation = [
  ...prescriptionIdValidation,
  body('patient').optional().isMongoId().withMessage('Patient must be a valid id'),
  body('appointment').optional({ values: 'falsy' }).isMongoId().withMessage('Appointment must be a valid id'),
  body('medications').optional().isArray({ min: 1 }).withMessage('Medications must be a non-empty array'),
  body('medications.*.name').optional().trim().notEmpty().withMessage('Medication name is required'),
  body('medications.*.dosage').optional().trim().notEmpty().withMessage('Medication dosage is required'),
  body('medications.*.frequency').optional().trim().notEmpty().withMessage('Medication frequency is required'),
  body('medications.*.duration').optional().trim().notEmpty().withMessage('Medication duration is required'),
  body('medications.*.instructions').optional().isString(),
  body('notes').optional().isString(),
  body('status')
    .optional()
    .isIn(['active', 'completed', 'cancelled'])
    .withMessage('Prescription status is invalid'),
];

module.exports = {
  prescriptionIdValidation,
  createPrescriptionValidation,
  updatePrescriptionValidation,
};
