const DoctorAvailability = require('../models/DoctorAvailability');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const {
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
