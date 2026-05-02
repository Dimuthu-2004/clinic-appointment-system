const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Billing = require('../models/Billing');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { resolveDoctorAvailabilityQuestion } = require('../utils/availabilityQuery');
const { ensureResourceAccess } = require('../utils/access');
const {
  buildAppointmentDate,
  inferAppointmentSession,
  isClinicSessionAvailableForDate,
  isPastDateKey,
  loadClinicScheduleFromDb,
  normalizeDateKey,
} = require('../utils/clinicSchedule');
const { isDoctorSessionAvailable } = require('../utils/doctorAvailability');
const {
  ensureBillingForAppointment,
  getAppointmentFee,
} = require('../utils/appointmentBilling');
const { createNotification, formatNotificationDateTime } = require('../utils/notifications');

const populateAppointment = [
  { path: 'patient', select: 'firstName lastName email phone' },
  { path: 'doctor', select: 'firstName lastName email specialization' },
];

const PATIENT_CANCELLATION_NOTICE_MS = 6 * 60 * 60 * 1000;

const getNextTokenNumber = async ({ doctorId, appointmentDate, appointmentSession, excludedAppointmentId = null }) => {
  const filter = {
    doctor: doctorId,
    appointmentDate,
    appointmentSession,
  };

  if (excludedAppointmentId) {
    filter._id = { $ne: excludedAppointmentId };
  }

  const latestAppointment = await Appointment.findOne(filter).select('tokenNumber').sort({ tokenNumber: -1 });
  return (latestAppointment?.tokenNumber || 0) + 1;
};

const ensureAppointmentActors = async ({ patientId, doctorId }) => {
  const [patient, doctor] = await Promise.all([
    User.findById(patientId),
    User.findById(doctorId),
  ]);

  if (!patient || patient.role !== 'patient') {
    throw new ApiError(404, 'Patient not found');
  }

  if (!doctor || doctor.role !== 'doctor') {
    throw new ApiError(404, 'Doctor not found');
  }
};

const prepareAppointmentSchedule = async ({ doctorId, appointmentDate, appointmentSession }) => {
  await loadClinicScheduleFromDb();
  const dateKey = normalizeDateKey(appointmentDate);
  const resolvedSession = appointmentSession || inferAppointmentSession(appointmentDate);

  if (!dateKey) {
    throw new ApiError(422, 'A valid appointment date is required');
  }

  if (isPastDateKey(dateKey)) {
    throw new ApiError(422, 'Appointments must be scheduled for today or a future date');
  }

  if (!resolvedSession || !isClinicSessionAvailableForDate(dateKey, resolvedSession)) {
    throw new ApiError(422, 'Please choose a valid clinic session for the selected date');
  }

  const doctorIsAvailable = await isDoctorSessionAvailable({
    doctorId,
    dateInput: dateKey,
    session: resolvedSession,
  });

  if (!doctorIsAvailable) {
    throw new ApiError(422, 'The doctor is unavailable for the selected date and session');
  }

  return {
    appointmentDate: buildAppointmentDate(dateKey, resolvedSession),
    appointmentSession: resolvedSession,
  };
};

const ensureAppointmentCanStillBeScheduled = (appointmentDate) => {
  if (!appointmentDate) {
    throw new ApiError(422, 'A valid appointment date is required');
  }

  const leadTimeMs = new Date(appointmentDate).getTime() - Date.now();

  if (leadTimeMs < 0) {
    throw new ApiError(422, 'Appointments must be scheduled for a future clinic session');
  }
};

const ensurePatientCanCancelAppointment = (appointment) => {
  if (!appointment?.appointmentDate) {
    throw new ApiError(422, 'A valid appointment date is required');
  }

  if (appointment.status === 'completed') {
    throw new ApiError(422, 'Completed appointments cannot be cancelled');
  }

  if (appointment.status === 'cancelled') {
    throw new ApiError(422, 'This appointment is already cancelled');
  }

  const remainingMs = new Date(appointment.appointmentDate).getTime() - Date.now();

  if (remainingMs < PATIENT_CANCELLATION_NOTICE_MS) {
    throw new ApiError(422, 'Appointments must be cancelled at least 6 hours before the scheduled time');
  }
};

const ensurePatientCanUpdateAppointment = async (appointment) => {
  if (!appointment?.appointmentDate) {
    throw new ApiError(422, 'A valid appointment date is required');
  }

  if (appointment.status === 'completed') {
    throw new ApiError(422, 'Completed appointments cannot be updated');
  }

  if (appointment.status === 'cancelled') {
    throw new ApiError(422, 'Cancelled appointments cannot be updated');
  }

  const billing = await Billing.findOne({ appointment: appointment._id }).select('status');

  if (billing?.status === 'paid') {
    throw new ApiError(422, 'Paid appointments can no longer be updated');
  }

  const remainingMs = new Date(appointment.appointmentDate).getTime() - Date.now();

  if (remainingMs < PATIENT_CANCELLATION_NOTICE_MS) {
    throw new ApiError(422, 'Appointments can only be updated at least 6 hours before the scheduled time');
  }

  return billing;
};

const createAppointment = asyncHandler(async (req, res) => {
  const patientId = req.user.role === 'patient' ? req.user._id : req.body.patient;

  if (!patientId) {
    throw new ApiError(400, 'Patient is required');
  }

  await ensureAppointmentActors({ patientId, doctorId: req.body.doctor });
  const appointmentSchedule = await prepareAppointmentSchedule({
    doctorId: req.body.doctor,
    appointmentDate: req.body.appointmentDate,
    appointmentSession: req.body.appointmentSession,
  });
  const tokenNumber = await getNextTokenNumber({
    doctorId: req.body.doctor,
    appointmentDate: appointmentSchedule.appointmentDate,
    appointmentSession: appointmentSchedule.appointmentSession,
  });
  ensureAppointmentCanStillBeScheduled(appointmentSchedule.appointmentDate);

  const appointment = await Appointment.create({
    ...req.body,
    patient: patientId,
    ...appointmentSchedule,
    tokenNumber,
    reason: String(req.body.reason || 'Clinic appointment').trim(),
  });
  const billing = await ensureBillingForAppointment({
    appointment,
    patientId,
    doctorId: req.body.doctor,
    paymentMethod: req.body.paymentMethod || 'paypal',
  });

  const populatedAppointment = await Appointment.findById(appointment._id).populate(populateAppointment);
  const appointmentData = populatedAppointment.toObject();
  appointmentData.paymentSummary = {
    billingId: billing._id,
    amount: billing.amount,
    currency: billing.currency,
    dueDate: billing.dueDate,
    paymentMethod: billing.paymentMethod,
  };

  await createNotification({
    recipientId: patientId,
    createdBy: req.user._id,
    type: 'appointment',
    title: 'Appointment booked',
    message: `Your appointment with Dr ${populatedAppointment.doctor?.firstName || ''} ${populatedAppointment.doctor?.lastName || ''} is scheduled for ${formatNotificationDateTime(populatedAppointment.appointmentDate)}. Token ${appointment.tokenNumber}.`,
    entityModel: 'Appointment',
    entityId: appointment._id,
    metadata: {
      tokenNumber: appointment.tokenNumber,
      appointmentSession: appointment.appointmentSession,
      billingId: billing._id,
      paymentDueDate: billing.dueDate,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Appointment created successfully',
    data: appointmentData,
  });
});

const getAppointments = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === 'patient') {
    filter.patient = req.user._id;
  }

  if (req.user.role === 'doctor') {
    filter.doctor = req.user._id;
  }

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const appointments = await Appointment.find(filter)
    .populate(populateAppointment)
    .sort({ appointmentDate: -1 });

  res.status(200).json({
    success: true,
    count: appointments.length,
    data: appointments,
  });
});

const searchAvailableDoctors = asyncHandler(async (req, res) => {
  await loadClinicScheduleFromDb();
  const dateKey = normalizeDateKey(req.query.date);
  const appointmentDate = buildAppointmentDate(dateKey, req.query.session);

  if (!appointmentDate) {
    throw new ApiError(422, 'Please choose a valid clinic date and session');
  }

  ensureAppointmentCanStillBeScheduled(appointmentDate);

  const filter = {
    role: 'doctor',
  };

  if (req.query.specialization) {
    filter.specialization = req.query.specialization;
  }

  if (req.query.search) {
    filter.$or = [
      { firstName: { $regex: req.query.search, $options: 'i' } },
      { lastName: { $regex: req.query.search, $options: 'i' } },
      { specialization: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const doctors = await User.find(filter)
    .select('firstName lastName email specialization')
    .sort({ firstName: 1, lastName: 1 });

  const availabilityResults = await Promise.all(
    doctors.map(async (doctor) => {
      const isAvailable = await isDoctorSessionAvailable({
        doctorId: doctor._id,
        dateInput: dateKey,
        session: req.query.session,
      });

      if (!isAvailable) {
        return null;
      }

      const nextTokenNumber = await getNextTokenNumber({
        doctorId: doctor._id,
        appointmentDate,
        appointmentSession: req.query.session,
      });
      const appointmentFee = await getAppointmentFee(doctor._id);

      return {
        _id: doctor._id,
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        email: doctor.email,
        specialization: doctor.specialization,
        appointmentFee,
        nextTokenNumber,
      };
    })
  );

  const data = availabilityResults.filter(Boolean);

  res.status(200).json({
    success: true,
    count: data.length,
    data,
  });
});

const getBookingPreview = asyncHandler(async (req, res) => {
  await loadClinicScheduleFromDb();
  const doctor = await User.findById(req.query.doctor).select('firstName lastName specialization role');

  if (!doctor || doctor.role !== 'doctor') {
    throw new ApiError(404, 'Doctor not found');
  }

  const dateKey = normalizeDateKey(req.query.date);
  const appointmentDate = buildAppointmentDate(dateKey, req.query.session);

  if (!appointmentDate) {
    throw new ApiError(422, 'Please choose a valid clinic date and session');
  }

  ensureAppointmentCanStillBeScheduled(appointmentDate);

  const isAvailable = await isDoctorSessionAvailable({
    doctorId: doctor._id,
    dateInput: dateKey,
    session: req.query.session,
  });

  if (!isAvailable) {
    throw new ApiError(422, 'The doctor is unavailable for the selected date and session');
  }

  const nextTokenNumber = await getNextTokenNumber({
    doctorId: doctor._id,
    appointmentDate,
    appointmentSession: req.query.session,
  });
  const appointmentFee = await getAppointmentFee(doctor._id);

  res.status(200).json({
    success: true,
    data: {
      doctor,
      dateKey,
      session: req.query.session,
      nextTokenNumber,
      appointmentFee,
    },
  });
});

const listDoctorDirectory = asyncHandler(async (req, res) => {
  const filter = {
    role: 'doctor',
  };

  if (req.query.specialization) {
    filter.specialization = req.query.specialization;
  }

  if (req.query.search) {
    filter.$or = [
      { firstName: { $regex: req.query.search, $options: 'i' } },
      { lastName: { $regex: req.query.search, $options: 'i' } },
      { specialization: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const doctors = await User.find(filter)
    .select('firstName lastName email specialization')
    .sort({ firstName: 1, lastName: 1 });

  res.status(200).json({
    success: true,
    count: doctors.length,
    data: doctors,
  });
});

const answerAvailabilityQuestion = asyncHandler(async (req, res) => {
  const result = await resolveDoctorAvailabilityQuestion(req.query.message);

  res.status(200).json({
    success: true,
    data: result,
  });
});

const getAppointmentById = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate(populateAppointment);

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (!ensureResourceAccess(req.user, appointment, ['patient', 'doctor'])) {
    throw new ApiError(403, 'You do not have access to this appointment');
  }

  res.status(200).json({
    success: true,
    data: appointment,
  });
});

const updateAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (!ensureResourceAccess(req.user, appointment, ['patient', 'doctor'])) {
    throw new ApiError(403, 'You do not have access to update this appointment');
  }

  const patientFields = ['appointmentDate', 'appointmentSession', 'status'];
  const doctorFields = ['appointmentDate', 'appointmentSession'];
  const adminFields = ['patient', 'doctor', 'appointmentDate', 'appointmentSession'];

  let allowedFields = adminFields;

  if (req.user.role === 'patient') {
    allowedFields = [...patientFields, 'appointmentSession'];
    if (req.body.status && req.body.status !== 'cancelled') {
      throw new ApiError(403, 'Patients can only cancel their appointments');
    }
    if (req.body.status === 'cancelled' && (req.body.appointmentDate !== undefined || req.body.appointmentSession !== undefined)) {
      throw new ApiError(403, 'Cancellation requests cannot change the appointment schedule');
    }
  }

  if (req.user.role === 'doctor') {
    allowedFields = doctorFields;
  }

  const previousDoctorId = String(appointment.doctor);
  const previousAppointmentTime = appointment.appointmentDate.getTime();
  const previousSession = appointment.appointmentSession;
  const statusChangedToCancelled = req.user.role === 'patient' && req.body.status === 'cancelled';
  const patientRequestedScheduleChange =
    req.user.role === 'patient' &&
    (req.body.appointmentDate !== undefined || req.body.appointmentSession !== undefined);
  let linkedBilling = null;

  if (statusChangedToCancelled) {
    ensurePatientCanCancelAppointment(appointment);
  }

  if (patientRequestedScheduleChange) {
    linkedBilling = await ensurePatientCanUpdateAppointment(appointment);
  }

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      appointment[field] = req.body[field];
    }
  });

  if (req.body.patient || req.body.doctor) {
    await ensureAppointmentActors({
      patientId: appointment.patient,
      doctorId: appointment.doctor,
    });
  }

  if (req.body.appointmentDate || req.body.appointmentSession || req.body.doctor) {
    const appointmentSchedule = await prepareAppointmentSchedule({
      doctorId: appointment.doctor,
      appointmentDate: appointment.appointmentDate,
      appointmentSession: appointment.appointmentSession,
    });
    ensureAppointmentCanStillBeScheduled(appointmentSchedule.appointmentDate);

    const scheduleChanged =
      previousAppointmentTime !== appointmentSchedule.appointmentDate.getTime() ||
      previousSession !== appointmentSchedule.appointmentSession ||
      previousDoctorId !== String(appointment.doctor);

    appointment.appointmentDate = appointmentSchedule.appointmentDate;
    appointment.appointmentSession = appointmentSchedule.appointmentSession;

    if (scheduleChanged) {
      appointment.tokenNumber = await getNextTokenNumber({
        doctorId: appointment.doctor,
        appointmentDate: appointment.appointmentDate,
        appointmentSession: appointment.appointmentSession,
        excludedAppointmentId: appointment._id,
      });
    }
  }

  await appointment.save();

  if (appointment.status === 'cancelled') {
    await Billing.updateMany(
      {
        appointment: appointment._id,
        status: 'pending',
      },
      {
        status: 'cancelled',
      }
    );
  }

  if (req.user.role === 'patient' && patientRequestedScheduleChange) {
    await createNotification({
      recipientId: appointment.patient,
      createdBy: req.user._id,
      type: 'appointment',
      title: 'Appointment updated',
      message: `Your appointment was moved to ${formatNotificationDateTime(appointment.appointmentDate)}. Token ${appointment.tokenNumber}.`,
      entityModel: 'Appointment',
      entityId: appointment._id,
      metadata: {
        appointmentSession: appointment.appointmentSession,
        tokenNumber: appointment.tokenNumber,
        billingStatus: linkedBilling?.status || 'pending',
      },
    });
  }

  if (req.user.role === 'patient' && statusChangedToCancelled) {
    await createNotification({
      recipientId: appointment.patient,
      createdBy: req.user._id,
      type: 'appointment',
      title: 'Appointment cancelled',
      message: `Your appointment on ${formatNotificationDateTime(appointment.appointmentDate)} was cancelled successfully.`,
      entityModel: 'Appointment',
      entityId: appointment._id,
      metadata: {
        appointmentSession: appointment.appointmentSession,
        tokenNumber: appointment.tokenNumber,
      },
    });
  }

  const updatedAppointment = await Appointment.findById(appointment._id).populate(populateAppointment);

  res.status(200).json({
    success: true,
    message: 'Appointment updated successfully',
    data: updatedAppointment,
  });
});

const deleteAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (!ensureResourceAccess(req.user, appointment, ['patient', 'doctor'])) {
    throw new ApiError(403, 'You do not have access to delete this appointment');
  }

  if (req.user.role === 'patient') {
    throw new ApiError(403, 'Patients cannot delete appointments. Please cancel at least 6 hours before the scheduled time instead.');
  }

  const linkedBillingExists = await Billing.exists({ appointment: appointment._id });

  if (linkedBillingExists) {
    throw new ApiError(
      422,
      'This appointment already has a billing record. Cancel it instead of deleting so payment history stays intact.'
    );
  }

  await appointment.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Appointment deleted successfully',
  });
});

module.exports = {
  createAppointment,
  getBookingPreview,
  getAppointments,
  getAppointmentById,
  answerAvailabilityQuestion,
  listDoctorDirectory,
  searchAvailableDoctors,
  updateAppointment,
  deleteAppointment,
};
