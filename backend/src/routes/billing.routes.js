const express = require('express');
const billingController = require('../controllers/billing.controller');
const validateRequest = require('../middleware/validate.middleware');
const {
  billingIdValidation,
  createBillingValidation,
  updateBillingValidation,
} = require('../validations/billing.validation');

const router = express.Router();

router
  .route('/')
  .get(billingController.getBillings)
  .post(createBillingValidation, validateRequest, billingController.createBilling);

router.get(
  '/:id/invoice.pdf',
  billingIdValidation,
  validateRequest,
  billingController.downloadBillingInvoice
);

router
  .route('/:id')
  .get(billingIdValidation, validateRequest, billingController.getBillingById)
  .put(updateBillingValidation, validateRequest, billingController.updateBilling)
  .delete(billingIdValidation, validateRequest, billingController.deleteBilling);

module.exports = router;
