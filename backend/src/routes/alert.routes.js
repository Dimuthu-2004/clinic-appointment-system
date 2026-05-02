const express = require('express');
const alertController = require('../controllers/alert.controller');
const validateRequest = require('../middleware/validate.middleware');
const {
  alertIdValidation,
  createAlertValidation,
  previewAlertValidation,
  updateAlertValidation,
} = require('../validations/alert.validation');

const router = express.Router();

router.post('/preview-targets', previewAlertValidation, validateRequest, alertController.previewAlertTargets);

router
  .route('/')
  .get(alertController.getAlerts)
  .post(createAlertValidation, validateRequest, alertController.createAlert);

router
  .route('/:id')
  .get(alertIdValidation, validateRequest, alertController.getAlertById)
  .put(updateAlertValidation, validateRequest, alertController.updateAlert)
  .delete(alertIdValidation, validateRequest, alertController.deleteAlert);

module.exports = router;
