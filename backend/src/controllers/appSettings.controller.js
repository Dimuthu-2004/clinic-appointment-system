const AppSettings = require('../models/AppSettings');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  DEFAULT_CLINIC_SCHEDULE,
  availabilityScopeOptions,
  getClinicHoursList,
  loadClinicScheduleFromDb,
  setClinicSchedule,
  validateClinicSchedulePayload,
} = require('../utils/clinicSchedule');
const {
  DEFAULT_APPOINTMENT_FEE,
  getAppointmentFee,
  setAppointmentFee,
  validateAppointmentFeePayload,
} = require('../utils/appointmentBilling');

const getClinicConfig = asyncHandler(async (_req, res) => {
  await loadClinicScheduleFromDb();

  res.status(200).json({
    success: true,
    data: {
      clinicHours: getClinicHoursList(),
      appointmentFee: await getAppointmentFee(),
      availabilityScopeOptions,
    },
  });
});

const updateClinicSchedule = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only admins can update clinic opening hours');
  }

  const nextSchedule = req.body.clinicSchedule;
  if (!validateClinicSchedulePayload(nextSchedule)) {
    throw new ApiError(422, 'Clinic schedule is invalid');
  }

  const settings = await AppSettings.findOneAndUpdate(
    {},
    {
      clinicSchedule: nextSchedule,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  setClinicSchedule(settings.clinicSchedule || DEFAULT_CLINIC_SCHEDULE);
  setAppointmentFee(settings.appointmentFee || DEFAULT_APPOINTMENT_FEE);

  res.status(200).json({
    success: true,
    message: 'Clinic opening hours updated successfully',
    data: {
      clinicHours: getClinicHoursList(),
      appointmentFee: settings.appointmentFee || DEFAULT_APPOINTMENT_FEE,
      availabilityScopeOptions,
    },
  });
});

const updateAppointmentFee = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only admins can update the appointment fee');
  }

  const nextAppointmentFee = req.body.appointmentFee;

  if (!validateAppointmentFeePayload(nextAppointmentFee)) {
    throw new ApiError(422, 'Appointment fee must be greater than 0 and include a valid currency');
  }

  const settings = await AppSettings.findOneAndUpdate(
    {},
    {
      $set: {
        appointmentFee: {
          amount: Number(nextAppointmentFee.amount),
          currency: String(nextAppointmentFee.currency || 'LKR').trim().toUpperCase(),
        },
      },
      $setOnInsert: {
        clinicSchedule: DEFAULT_CLINIC_SCHEDULE,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  setAppointmentFee(settings.appointmentFee || DEFAULT_APPOINTMENT_FEE);

  res.status(200).json({
    success: true,
    message: 'Appointment fee updated successfully',
    data: {
      appointmentFee: settings.appointmentFee || DEFAULT_APPOINTMENT_FEE,
    },
  });
});

module.exports = {
  getClinicConfig,
  updateAppointmentFee,
  updateClinicSchedule,
};
