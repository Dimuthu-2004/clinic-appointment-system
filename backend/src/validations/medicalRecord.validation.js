const { body, param } = require('express-validator');

const validateFloatRange = (label, options) => (value) => {
  if (value === '' || value === null || value === undefined) {
    return true;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error(`${label} must be a valid number`);
  }

  if (options.min !== undefined && numericValue < options.min) {
    throw new Error(`${label} must be at least ${options.min}`);
  }

  if (options.max !== undefined && numericValue > options.max) {
    throw new Error(`${label} must be ${options.max} or less`);
  }

  return true;
};

const medicalRecordIdValidation = [param('id').isMongoId().withMessage('Invalid medical record id')];
const attachmentIdValidation = [
  param('id').isMongoId().withMessage('Invalid medical record id'),
  param('attachmentId').isMongoId().withMessage('Invalid attachment id'),
];

const createMedicalRecordValidation = [
  body('patient').isMongoId().withMessage('Patient is required'),
  body('appointment').optional({ values: 'falsy' }).isMongoId().withMessage('Appointment must be a valid id'),
  body('diagnosis').trim().notEmpty().withMessage('Diagnosis is required'),
  body('symptoms').optional().isString(),
  body('treatmentPlan').optional().isString(),
  body('notes').optional().isString(),
  body('clinicalVitals').optional().isObject().withMessage('Clinical vitals must be an object'),
  body('clinicalVitals.bloodPressure')
    .optional({ values: 'falsy' })
    .matches(/^\d{2,3}\/\d{2,3}$/)
    .withMessage('Blood pressure must be in the format 120/80'),
  body('clinicalVitals.heartRate')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Heart rate', { min: 1, max: 250 })),
  body('clinicalVitals.respiratoryRate')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Respiratory rate', { min: 1, max: 80 })),
  body('clinicalVitals.temperatureCelsius')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Temperature', { min: 30, max: 45 })),
  body('clinicalVitals.oxygenSaturation')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Oxygen saturation', { min: 1, max: 100 })),
  body('clinicalVitals.weightKg')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Weight', { min: 0.1, max: 400 })),
  body('clinicalVitals.heightCm')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Height', { min: 30, max: 300 })),
];

const updateMedicalRecordValidation = [
  ...medicalRecordIdValidation,
  body('patient').optional().isMongoId().withMessage('Patient must be a valid id'),
  body('appointment').optional({ values: 'falsy' }).isMongoId().withMessage('Appointment must be a valid id'),
  body('diagnosis').optional().trim().notEmpty().withMessage('Diagnosis cannot be empty'),
  body('symptoms').optional().isString(),
  body('treatmentPlan').optional().isString(),
  body('notes').optional().isString(),
  body('clinicalVitals').optional().isObject().withMessage('Clinical vitals must be an object'),
  body('clinicalVitals.bloodPressure')
    .optional({ values: 'falsy' })
    .matches(/^\d{2,3}\/\d{2,3}$/)
    .withMessage('Blood pressure must be in the format 120/80'),
  body('clinicalVitals.heartRate')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Heart rate', { min: 1, max: 250 })),
  body('clinicalVitals.respiratoryRate')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Respiratory rate', { min: 1, max: 80 })),
  body('clinicalVitals.temperatureCelsius')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Temperature', { min: 30, max: 45 })),
  body('clinicalVitals.oxygenSaturation')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Oxygen saturation', { min: 1, max: 100 })),
  body('clinicalVitals.weightKg')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Weight', { min: 0.1, max: 400 })),
  body('clinicalVitals.heightCm')
    .optional({ values: 'falsy' })
    .custom(validateFloatRange('Height', { min: 30, max: 300 })),
  body('isArchived').optional().isBoolean().withMessage('isArchived must be true or false'),
];

module.exports = {
  medicalRecordIdValidation,
  attachmentIdValidation,
  createMedicalRecordValidation,
  updateMedicalRecordValidation,
};
