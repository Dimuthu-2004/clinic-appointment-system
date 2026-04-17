const { body, query } = require('express-validator');
const {
  AVAILABILITY_SESSION_SCOPES,
  AVAILABILITY_STATUSES,
} = require('../utils/clinicSchedule');

const listDoctorAvailabilityValidation = [
  query('doctor').optional().isMongoId().withMessage('Doctor must be a valid id'),
  query('from').optional().isISO8601().withMessage('From date must be valid'),
];

const doctorAvailabilityOptionsValidation = [
  query('doctor').optional().isMongoId().withMessage('Doctor must be a valid id'),
  query('date').isISO8601().withMessage('A valid date is required'),
];

const saveDoctorAvailabilityValidation = [
  body('doctor').optional().isMongoId().withMessage('Doctor must be a valid id'),
  body('date').isISO8601().withMessage('A valid date is required'),
  body('sessionScope')
    .isIn(AVAILABILITY_SESSION_SCOPES)
    .withMessage('Session scope must be morning, evening, or full_day'),
  body('availability')
    .isIn(AVAILABILITY_STATUSES)
    .withMessage('Availability must be available or unavailable'),
];

module.exports = {
  doctorAvailabilityOptionsValidation,
  listDoctorAvailabilityValidation,
  saveDoctorAvailabilityValidation,
};
