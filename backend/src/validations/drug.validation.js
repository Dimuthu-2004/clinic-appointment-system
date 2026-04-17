const { body, param } = require('express-validator');

const drugIdValidation = [param('id').isMongoId().withMessage('Invalid drug id')];

const createDrugValidation = [
  body('name').trim().notEmpty().withMessage('Drug name is required'),
  body('genericName').optional().isString(),
  body('category').optional().isString(),
  body('dosageForm').optional().isString(),
  body('strength').optional().isString(),
  body('manufacturer').optional().isString(),
  body('batchNumber').optional().isString(),
  body('quantityInStock').isFloat({ min: 0 }).withMessage('Quantity must be 0 or more'),
  body('reorderLevel').optional().isFloat({ min: 0 }).withMessage('Reorder level must be 0 or more'),
  body('unitPrice').isFloat({ gt: 0 }).withMessage('Unit price must be greater than 0'),
  body('expiryDate').isISO8601().withMessage('Expiry date is required'),
  body('description').optional().isString(),
  body('imageUrl').optional().isString(),
  body('isActive').optional().isBoolean(),
];

const updateDrugValidation = [
  ...drugIdValidation,
  body('name').optional().trim().notEmpty(),
  body('genericName').optional().isString(),
  body('category').optional().isString(),
  body('dosageForm').optional().isString(),
  body('strength').optional().isString(),
  body('manufacturer').optional().isString(),
  body('batchNumber').optional().isString(),
  body('quantityInStock').optional().isFloat({ min: 0 }).withMessage('Quantity must be 0 or more'),
  body('reorderLevel').optional().isFloat({ min: 0 }).withMessage('Reorder level must be 0 or more'),
  body('unitPrice').optional().isFloat({ gt: 0 }).withMessage('Unit price must be greater than 0'),
  body('expiryDate').optional().isISO8601().withMessage('Expiry date is invalid'),
  body('description').optional().isString(),
  body('imageUrl').optional().isString(),
  body('isActive').optional().isBoolean(),
];

module.exports = {
  drugIdValidation,
  createDrugValidation,
  updateDrugValidation,
};
