const { body } = require('express-validator');
const { STAFF_ROLE_VALUES, USER_ROLES } = require('../utils/roles');
const {
  isStrongPassword,
  isValidSriLankanNic,
  PASSWORD_REQUIREMENTS_MESSAGE,
} = require('../utils/validation');

const baseValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('password')
    .custom((value) => isStrongPassword(value))
    .withMessage(PASSWORD_REQUIREMENTS_MESSAGE),
  body('phone')
    .trim()
    .matches(/^(\+94|0)\d{9}$/)
    .withMessage('Phone number must be a valid Sri Lankan number'),
  body('address').optional().isString(),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('Invalid gender'),
  body('dateOfBirth').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid date of birth'),
];

const patientRegisterValidation = [...baseValidation];

const doctorRegisterValidation = [
  ...baseValidation,
  body('specialization').trim().notEmpty().withMessage('Specialization is required'),
  body('nic')
    .custom((value) => isValidSriLankanNic(value))
    .withMessage('NIC must match the Sri Lankan old or new NIC format'),
];

const staffRegisterValidation = [
  ...baseValidation,
  body('role')
    .isIn(STAFF_ROLE_VALUES)
    .withMessage('Staff role must be finance_manager or pharmacist'),
  body('nic')
    .custom((value) => isValidSriLankanNic(value))
    .withMessage('NIC must match the Sri Lankan old or new NIC format'),
];

const loginValidation = [
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const requestPasswordResetValidation = [body('email').isEmail().withMessage('A valid email is required')];

const resetPasswordValidation = [
  body('email').isEmail().withMessage('A valid email is required'),
  body('resetCode')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Reset code must be a valid 6-digit code'),
  body('password')
    .custom((value) => isStrongPassword(value))
    .withMessage(PASSWORD_REQUIREMENTS_MESSAGE),
];

const updateProfileValidation = [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().withMessage('A valid email is required'),
  body('phone')
    .optional()
    .matches(/^(\+94|0)\d{9}$/)
    .withMessage('Phone number must be a valid Sri Lankan number'),
  body('address').optional().isString(),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other', 'prefer_not_to_say'])
    .withMessage('Invalid gender'),
  body('dateOfBirth').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid date of birth'),
  body('specialization').optional().isString(),
  body('nic')
    .optional({ values: 'falsy' })
    .custom((value) => isValidSriLankanNic(value))
    .withMessage('NIC must match the Sri Lankan old or new NIC format'),
  body('slmcRegistrationNumber').optional().isString(),
];

module.exports = {
  patientRegisterValidation,
  doctorRegisterValidation,
  staffRegisterValidation,
  loginValidation,
  requestPasswordResetValidation,
  resetPasswordValidation,
  updateProfileValidation,
};
