const { body, param, query } = require('express-validator');
const { ROLE_VALUES } = require('../utils/roles');
const {
  isStrongPassword,
  isValidSriLankanNic,
  PASSWORD_REQUIREMENTS_MESSAGE,
} = require('../utils/validation');

const listUsersValidation = [
  query('role')
    .optional()
    .isIn(ROLE_VALUES)
    .withMessage('Role filter is invalid'),
  query('search').optional().isString(),
];

const userIdValidation = [param('id').isMongoId().withMessage('Invalid user id')];

const createUserValidation = [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').custom((value) => isStrongPassword(value)).withMessage(PASSWORD_REQUIREMENTS_MESSAGE),
  body('role').isIn(ROLE_VALUES).withMessage('Role is invalid'),
  body('phone')
    .optional()
    .matches(/^(\+94|0)\d{9}$/)
    .withMessage('Phone number must be a valid Sri Lankan number'),
  body('nic')
    .optional({ values: 'falsy' })
    .custom((value) => isValidSriLankanNic(value))
    .withMessage('NIC must match the Sri Lankan old or new NIC format'),
];

const updateUserValidation = [
  ...userIdValidation,
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('email').optional().isEmail().withMessage('A valid email is required'),
  body('password').optional().custom((value) => isStrongPassword(value)).withMessage(PASSWORD_REQUIREMENTS_MESSAGE),
  body('role').optional().isIn(ROLE_VALUES).withMessage('Role is invalid'),
  body('phone')
    .optional()
    .matches(/^(\+94|0)\d{9}$/)
    .withMessage('Phone number must be a valid Sri Lankan number'),
  body('nic')
    .optional({ values: 'falsy' })
    .custom((value) => isValidSriLankanNic(value))
    .withMessage('NIC must match the Sri Lankan old or new NIC format'),
];

module.exports = {
  listUsersValidation,
  userIdValidation,
  createUserValidation,
  updateUserValidation,
};
