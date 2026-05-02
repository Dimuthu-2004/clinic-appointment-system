const Appointment = require('../models/Appointment');
const DoctorAvailability = require('../models/DoctorAvailability');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  CLINIC_TIMEZONE_OFFSET,
  hasClinicSessionStarted,
  getClinicSessionsForDate,
  getTodayDateKey,
  isPastDateKey,
  loadClinicScheduleFromDb,
  normalizeDateKey,
} = require('../utils/clinicSchedule');
const { getDoctorSessionAvailability } = require('../utils/doctorAvailability');

const resolveDoctorId = async ({ req, fallbackDoctorId }) => {
  const doctorId = req.user.role === 'doctor' ? req.user._id : fallbackDoctorId;

  if (!doctorId) {
    throw new ApiError(400, 'Doctor is required');
  }

  const doctor = await User.findById(doctorId);

  if (!doctor || doctor.role !== 'doctor') {
    throw new ApiError(404, 'Doctor not found');
  }

  return doctor._id;
};

const getDateRangeForDateKey = (dateKey) => {
  const start = new Date(`${dateKey}T00:00:00${CLINIC_TIMEZONE_OFFSET}`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
};

const ensureNoFutureAppointmentsConflict = async ({ doctorId, dateKey, sessionScope, availability }) => {
  if (availability !== 'unavailable') {
    return;
  }

  const { start, end } = getDateRangeForDateKey(dateKey);
  const futureStart = new Date(Math.max(start.getTime(), Date.now()));
  const filter = {
    doctor: doctorId,
    appointmentDate: {
      $gte: futureStart,
      $lt: end,
    },
    status: { $ne: 'cancelled' },
  };

  if (sessionScope !== 'full_day') {
    filter.appointmentSession = sessionScope;
  }

  const conflictingAppointment = await Appointment.findOne(filter).select(
    'appointmentSession appointmentDate tokenNumber'
  );

  if (!conflictingAppointment) {
    return;
  }

  if (sessionScope === 'full_day') {
    throw new ApiError(
      422,
      'This day already has future patient appointments, so it cannot be marked unavailable.'
    );
  }

  throw new ApiError(
    422,
    `The ${sessionScope} session already has future patient appointments, so it cannot be marked unavailable.`
  );
};

const listDoctorAvailability = asyncHandler(async (req, res) => {
  await loadClinicScheduleFromDb();
  const doctorId = await resolveDoctorId({ req, fallbackDoctorId: req.query.doctor });
  const fromDateKey = normalizeDateKey(req.query.from) || getTodayDateKey();

  const availability = await DoctorAvailability.find({
    doctor: doctorId,
    dateKey: { $gte: fromDateKey },
  }).sort({ dateKey: 1, sessionScope: 1 });

  res.status(200).json({
    success: true,
    count: availability.length,
    data: availability,
  });
});

const saveDoctorAvailability = asyncHandler(async (req, res) => {
  await loadClinicScheduleFromDb();
  const doctorId = await resolveDoctorId({ req, fallbackDoctorId: req.body.doctor });
  const dateKey = normalizeDateKey(req.body.date);

  if (!dateKey) {
    throw new ApiError(422, 'A valid availability date is required');
  }

  if (isPastDateKey(dateKey)) {
    throw new ApiError(422, 'Availability can only be changed for today or future dates');
  }

  const sessions = getClinicSessionsForDate(dateKey);

  if (!sessions.length) {
    throw new ApiError(422, 'No clinic sessions are available for the selected date');
  }

  if (req.body.sessionScope !== 'full_day' && !sessions.some((session) => session.value === req.body.sessionScope)) {
    throw new ApiError(422, 'The selected clinic session is closed for that date');
  }

  if (dateKey === getTodayDateKey()) {
    if (req.body.sessionScope === 'full_day') {
      const hasStartedSession = sessions.some((session) => hasClinicSessionStarted(dateKey, session.value));

      if (hasStartedSession) {
        throw new ApiError(422, 'Full-day availability can only be changed before today\'s first clinic session starts');
      }
    } else if (hasClinicSessionStarted(dateKey, req.body.sessionScope)) {
      throw new ApiError(422, 'Past or already-started clinic sessions cannot be changed');
    }
  }

  await ensureNoFutureAppointmentsConflict({
    doctorId,
    dateKey,
    sessionScope: req.body.sessionScope,
    availability: req.body.availability,
  });

  const availability = await DoctorAvailability.findOneAndUpdate(
    {
      doctor: doctorId,
      dateKey,
      sessionScope: req.body.sessionScope,
    },
    {
      doctor: doctorId,
      dateKey,
      sessionScope: req.body.sessionScope,
      availability: req.body.availability,
      updatedBy: req.user._id,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  res.status(200).json({
    success: true,
    message: 'Doctor availability saved successfully',
    data: availability,
  });
});

const getDoctorAvailabilityOptions = asyncHandler(async (req, res) => {
  await loadClinicScheduleFromDb();
  const doctorId = await resolveDoctorId({ req, fallbackDoctorId: req.query.doctor });
  const dateKey = normalizeDateKey(req.query.date);

  if (!dateKey) {
    throw new ApiError(422, 'A valid date is required');
  }

  const sessions = await getDoctorSessionAvailability({
    doctorId,
    dateInput: dateKey,
  });

  res.status(200).json({
    success: true,
    data: {
      dateKey,
      sessions,
    },
  });
});

module.exports = {
  getDoctorAvailabilityOptions,
  listDoctorAvailability,
  saveDoctorAvailability,
};
