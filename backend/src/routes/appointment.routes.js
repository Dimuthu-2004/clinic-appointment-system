const express = require('express');
const appointmentController = require('../controllers/appointment.controller');
const { protect } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validate.middleware');
const {
  availabilityQuestionValidation,
  availableDoctorsValidation,
  appointmentIdValidation,
  bookingPreviewValidation,
  createAppointmentValidation,
  updateAppointmentValidation,
  listAppointmentValidation,
} = require('../validations/appointment.validation');

const router = express.Router();

router.get('/doctor-directory', appointmentController.listDoctorDirectory);

router.get(
  '/availability-question',
  availabilityQuestionValidation,
  validateRequest,
  appointmentController.answerAvailabilityQuestion
);

router.get(
  '/available-doctors',
  availableDoctorsValidation,
  validateRequest,
  appointmentController.searchAvailableDoctors
);

router.get(
  '/booking-preview',
  bookingPreviewValidation,
  validateRequest,
  appointmentController.getBookingPreview
);

router
  .route('/')
  .get(protect, listAppointmentValidation, validateRequest, appointmentController.getAppointments)
  .post(protect, createAppointmentValidation, validateRequest, appointmentController.createAppointment);

router
  .route('/:id')
  .get(protect, appointmentIdValidation, validateRequest, appointmentController.getAppointmentById)
  .put(protect, updateAppointmentValidation, validateRequest, appointmentController.updateAppointment)
  .delete(protect, appointmentIdValidation, validateRequest, appointmentController.deleteAppointment);

module.exports = router;
