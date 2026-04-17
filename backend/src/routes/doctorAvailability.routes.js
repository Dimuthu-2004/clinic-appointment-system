const express = require('express');
const doctorAvailabilityController = require('../controllers/doctorAvailability.controller');
const { authorize } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validate.middleware');
const {
  doctorAvailabilityOptionsValidation,
  listDoctorAvailabilityValidation,
  saveDoctorAvailabilityValidation,
} = require('../validations/doctorAvailability.validation');

const router = express.Router();

router.get(
  '/options',
  authorize('doctor', 'patient', 'admin'),
  doctorAvailabilityOptionsValidation,
  validateRequest,
  doctorAvailabilityController.getDoctorAvailabilityOptions
);

router
  .route('/')
  .get(
    authorize('doctor', 'admin'),
    listDoctorAvailabilityValidation,
    validateRequest,
    doctorAvailabilityController.listDoctorAvailability
  )
  .post(
    authorize('doctor', 'admin'),
    saveDoctorAvailabilityValidation,
    validateRequest,
    doctorAvailabilityController.saveDoctorAvailability
  );

module.exports = router;
