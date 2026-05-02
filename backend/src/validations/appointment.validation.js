const { body, param, query } = require('express-validator');

const appointmentIdValidation = [param('id').isMongoId().withMessage('Invalid appointment id')];

const availabilityQuestionValidation = [
  query('message').trim().notEmpty().withMessage('A message is required'),
];

const availableDoctorsValidation = [
  query('date').isISO8601().withMessage('A valid date is required'),
  query('session')
    .isIn(['morning', 'evening'])
    .withMessage('Session must be morning or evening'),
  query('search').optional().isString(),
  query('specialization').optional().isString(),
];

const bookingPreviewValidation = [
  query('doctor').isMongoId().withMessage('Doctor is required'),
  query('date').isISO8601().withMessage('A valid date is required'),
  query('session')
    .isIn(['morning', 'evening'])
    .withMessage('Session must be morning or evening'),
];

const createAppointmentValidation = [
  body('doctor').isMongoId().withMessage('Doctor is required'),
  body('patient').optional().isMongoId().withMessage('Patient must be a valid id'),
  body('appointmentDate').isISO8601().withMessage('Appointment date is required'),
  body('appointmentSession')
    .isIn(['morning', 'evening'])
    .withMessage('Appointment session must be morning or evening'),
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'card', 'paypal'])
    .withMessage('Payment method is invalid'),
  body('reason').optional().isString(),
];

const updateAppointmentValidation = [
  ...appointmentIdValidation,
  body('doctor').optional().isMongoId().withMessage('Doctor must be a valid id'),
  body('patient').optional().isMongoId().withMessage('Patient must be a valid id'),
  body('appointmentDate').optional().isISO8601().withMessage('Appointment date is invalid'),
  body('appointmentSession')
    .optional()
    .isIn(['morning', 'evening'])
    .withMessage('Appointment session must be morning or evening'),
  body('reason').optional().trim().notEmpty().withMessage('Reason cannot be empty'),
  body('status')
    .optional()
    .isIn(['scheduled', 'confirmed', 'completed', 'cancelled'])
    .withMessage('Status is invalid'),
  body('patientNotes').optional().isString(),
  body('doctorNotes').optional().isString(),
];

const listAppointmentValidation = [
  query('status')
    .optional()
    .isIn(['scheduled', 'confirmed', 'completed', 'cancelled'])
    .withMessage('Status filter is invalid'),
];

module.exports = {
  availabilityQuestionValidation,
  availableDoctorsValidation,
  appointmentIdValidation,
  bookingPreviewValidation,
  createAppointmentValidation,
  updateAppointmentValidation,
  listAppointmentValidation,
};
