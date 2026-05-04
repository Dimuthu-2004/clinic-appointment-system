const express = require('express');
const prescriptionController = require('../controllers/prescription.controller');
const validateRequest = require('../middleware/validate.middleware');
const {
  prescriptionIdValidation,
  createPrescriptionValidation,
  updatePrescriptionValidation,
} = require('../validations/prescription.validation');

const router = express.Router();

router
  .route('/')
  .get(prescriptionController.getPrescriptions)
  .post(createPrescriptionValidation, validateRequest, prescriptionController.createPrescription);

router
  .route('/:id/availability')
  .get(prescriptionIdValidation, validateRequest, prescriptionController.getPrescriptionAvailability);

router
  .route('/:id/pdf')
  .get(prescriptionIdValidation, validateRequest, prescriptionController.downloadPrescriptionPdf);

router
  .route('/:id')
  .get(prescriptionIdValidation, validateRequest, prescriptionController.getPrescriptionById)
  .put(updatePrescriptionValidation, validateRequest, prescriptionController.updatePrescription)
  .delete(prescriptionIdValidation, validateRequest, prescriptionController.deletePrescription);

module.exports = router;
