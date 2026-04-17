const fs = require('fs');
const path = require('path');
const Appointment = require('../models/Appointment');
const Billing = require('../models/Billing');
const MedicalRecord = require('../models/MedicalRecord');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ensureResourceAccess } = require('../utils/access');
const { getTodayDateKey, normalizeDateKey } = require('../utils/clinicSchedule');

const populateMedicalRecord = [
  { path: 'patient', select: 'firstName lastName email phone' },
  { path: 'doctor', select: 'firstName lastName specialization' },
  { path: 'appointment', select: 'appointmentDate appointmentSession tokenNumber reason status' },
];

const normalizeClinicalVitals = (vitals = {}) => ({
  bloodPressure: String(vitals.bloodPressure || '').trim(),
  heartRate: vitals.heartRate === '' || vitals.heartRate === undefined || vitals.heartRate === null ? null : Number(vitals.heartRate),
  respiratoryRate:
    vitals.respiratoryRate === '' || vitals.respiratoryRate === undefined || vitals.respiratoryRate === null
      ? null
      : Number(vitals.respiratoryRate),
  temperatureCelsius:
    vitals.temperatureCelsius === '' || vitals.temperatureCelsius === undefined || vitals.temperatureCelsius === null
      ? null
      : Number(vitals.temperatureCelsius),
  oxygenSaturation:
    vitals.oxygenSaturation === '' || vitals.oxygenSaturation === undefined || vitals.oxygenSaturation === null
      ? null
      : Number(vitals.oxygenSaturation),
  weightKg: vitals.weightKg === '' || vitals.weightKg === undefined || vitals.weightKg === null ? null : Number(vitals.weightKg),
  heightCm: vitals.heightCm === '' || vitals.heightCm === undefined || vitals.heightCm === null ? null : Number(vitals.heightCm),
});

const ensureMedicalRecordActors = async ({ patientId, doctorId, appointmentId }) => {
  const [patient, doctor, appointment] = await Promise.all([
    User.findById(patientId),
    User.findById(doctorId),
    appointmentId ? Appointment.findById(appointmentId) : Promise.resolve(null),
  ]);

  if (!patient || patient.role !== 'patient') {
    throw new ApiError(404, 'Patient not found');
  }

  if (!doctor || doctor.role !== 'doctor') {
    throw new ApiError(404, 'Doctor not found');
  }

  if (appointmentId && !appointment) {
    throw new ApiError(404, 'Appointment not found');
  }

  if (appointment) {
    if (String(appointment.patient) !== String(patientId)) {
      throw new ApiError(422, 'The appointment does not belong to the selected patient');
    }

    if (String(appointment.doctor) !== String(doctorId)) {
      throw new ApiError(422, 'The appointment does not belong to the selected doctor');
    }
  }

  return {
    patient,
    doctor,
    appointment,
  };
};

const ensureDoctorCanStartAppointmentToday = async ({ reqUser, appointment }) => {
  if (reqUser.role !== 'doctor' || !appointment) {
    return;
  }

  if (String(appointment.doctor) !== String(reqUser._id)) {
    throw new ApiError(403, 'You can only start appointments assigned to you');
  }

  if (normalizeDateKey(appointment.appointmentDate) !== getTodayDateKey()) {
    throw new ApiError(422, 'You can only start appointments on the scheduled appointment day');
  }

  if (appointment.status === 'cancelled') {
    throw new ApiError(422, 'Cancelled appointments cannot be started');
  }

  if (appointment.status === 'completed') {
    throw new ApiError(422, 'This appointment has already been completed');
  }

  const billing = await Billing.findOne({ appointment: appointment._id }).select('status');

  if (!billing || billing.status !== 'paid') {
    throw new ApiError(422, 'Payment must be completed before this appointment can be started');
  }
};

const createMedicalRecord = asyncHandler(async (req, res) => {
  if (req.user.role === 'patient') {
    throw new ApiError(403, 'Patients cannot create medical records');
  }

  const payload = {
    ...req.body,
    doctor: req.user.role === 'doctor' ? req.user._id : req.body.doctor,
  };

  if (!payload.doctor) {
    throw new ApiError(400, 'Doctor is required');
  }

  const actorContext = await ensureMedicalRecordActors({
    patientId: payload.patient,
    doctorId: payload.doctor,
    appointmentId: payload.appointment,
  });
  await ensureDoctorCanStartAppointmentToday({ reqUser: req.user, appointment: actorContext.appointment });

  payload.clinicalVitals = normalizeClinicalVitals(req.body.clinicalVitals || {});

  const medicalRecord = await MedicalRecord.create(payload);

  if (actorContext.appointment && actorContext.appointment.status !== 'completed') {
    actorContext.appointment.status = 'completed';
    await actorContext.appointment.save();
  }

  const populatedRecord = await MedicalRecord.findById(medicalRecord._id).populate(populateMedicalRecord);

  res.status(201).json({
    success: true,
    message: 'Medical record created successfully',
    data: populatedRecord,
  });
});

const getMedicalRecords = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === 'patient') {
    filter.patient = req.user._id;
  }

  if (req.user.role === 'doctor') {
    filter.doctor = req.user._id;
  }

  if (req.query.archived === 'true') {
    filter.isArchived = true;
  } else if (req.query.archived === 'false') {
    filter.isArchived = false;
  }

  const medicalRecords = await MedicalRecord.find(filter)
    .populate(populateMedicalRecord)
    .sort({ updatedAt: -1 });

  res.status(200).json({
    success: true,
    count: medicalRecords.length,
    data: medicalRecords,
  });
});

const getMedicalRecordById = asyncHandler(async (req, res) => {
  const medicalRecord = await MedicalRecord.findById(req.params.id).populate(populateMedicalRecord);

  if (!medicalRecord) {
    throw new ApiError(404, 'Medical record not found');
  }

  if (!ensureResourceAccess(req.user, medicalRecord, ['patient', 'doctor'])) {
    throw new ApiError(403, 'You do not have access to this medical record');
  }

  res.status(200).json({
    success: true,
    data: medicalRecord,
  });
});

const updateMedicalRecord = asyncHandler(async (req, res) => {
  const medicalRecord = await MedicalRecord.findById(req.params.id);

  if (!medicalRecord) {
    throw new ApiError(404, 'Medical record not found');
  }

  if (req.user.role === 'patient' || !ensureResourceAccess(req.user, medicalRecord, ['doctor'])) {
    throw new ApiError(403, 'You do not have access to update this medical record');
  }

  const allowedFields = ['patient', 'doctor', 'appointment', 'diagnosis', 'symptoms', 'treatmentPlan', 'notes', 'isArchived'];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      medicalRecord[field] = req.body[field];
    }
  });

  if (req.body.clinicalVitals !== undefined) {
    medicalRecord.clinicalVitals = normalizeClinicalVitals(req.body.clinicalVitals || {});
  }

  const actorContext = await ensureMedicalRecordActors({
    patientId: medicalRecord.patient,
    doctorId: medicalRecord.doctor,
    appointmentId: medicalRecord.appointment,
  });
  await ensureDoctorCanStartAppointmentToday({ reqUser: req.user, appointment: actorContext.appointment });

  await medicalRecord.save();

  if (actorContext.appointment && actorContext.appointment.status !== 'completed') {
    actorContext.appointment.status = 'completed';
    await actorContext.appointment.save();
  }

  const updatedMedicalRecord = await MedicalRecord.findById(medicalRecord._id).populate(populateMedicalRecord);

  res.status(200).json({
    success: true,
    message: 'Medical record updated successfully',
    data: updatedMedicalRecord,
  });
});

const archiveMedicalRecord = asyncHandler(async (req, res) => {
  const medicalRecord = await MedicalRecord.findById(req.params.id);

  if (!medicalRecord) {
    throw new ApiError(404, 'Medical record not found');
  }

  if (req.user.role === 'patient' || !ensureResourceAccess(req.user, medicalRecord, ['doctor'])) {
    throw new ApiError(403, 'You do not have access to archive this medical record');
  }

  medicalRecord.isArchived = true;
  await medicalRecord.save();

  res.status(200).json({
    success: true,
    message: 'Medical record archived successfully',
    data: medicalRecord,
  });
});

const deleteMedicalRecord = asyncHandler(async (req, res) => {
  const medicalRecord = await MedicalRecord.findById(req.params.id);

  if (!medicalRecord) {
    throw new ApiError(404, 'Medical record not found');
  }

  if (req.user.role === 'patient' || !ensureResourceAccess(req.user, medicalRecord, ['doctor'])) {
    throw new ApiError(403, 'You do not have access to delete this medical record');
  }

  for (const attachment of medicalRecord.attachments) {
    const attachmentPath = path.join(__dirname, '../../', attachment.url);
    if (fs.existsSync(attachmentPath)) {
      fs.unlinkSync(attachmentPath);
    }
  }

  await medicalRecord.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Medical record deleted successfully',
  });
});

const uploadMedicalRecordAttachments = asyncHandler(async (req, res) => {
  const medicalRecord = await MedicalRecord.findById(req.params.id);

  if (!medicalRecord) {
    throw new ApiError(404, 'Medical record not found');
  }

  if (req.user.role === 'patient' || !ensureResourceAccess(req.user, medicalRecord, ['doctor'])) {
    throw new ApiError(403, 'You do not have access to upload attachments to this medical record');
  }

  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'At least one attachment file is required');
  }

  const attachments = req.files.map((file) => ({
    originalName: file.originalname,
    fileName: file.filename,
    mimeType: file.mimetype,
    size: file.size,
    url: path.join('uploads', 'medical-records', file.filename).replace(/\\/g, '/'),
  }));

  medicalRecord.attachments.push(...attachments);
  await medicalRecord.save();

  const updatedMedicalRecord = await MedicalRecord.findById(medicalRecord._id).populate(populateMedicalRecord);

  res.status(200).json({
    success: true,
    message: 'Attachment uploaded successfully',
    data: updatedMedicalRecord,
  });
});

const deleteMedicalRecordAttachment = asyncHandler(async (req, res) => {
  const medicalRecord = await MedicalRecord.findById(req.params.id);

  if (!medicalRecord) {
    throw new ApiError(404, 'Medical record not found');
  }

  if (req.user.role === 'patient' || !ensureResourceAccess(req.user, medicalRecord, ['doctor'])) {
    throw new ApiError(403, 'You do not have access to delete attachments from this medical record');
  }

  const attachment = medicalRecord.attachments.id(req.params.attachmentId);

  if (!attachment) {
    throw new ApiError(404, 'Attachment not found');
  }

  const attachmentPath = path.join(__dirname, '../../', attachment.url);
  if (fs.existsSync(attachmentPath)) {
    fs.unlinkSync(attachmentPath);
  }

  attachment.deleteOne();
  await medicalRecord.save();

  res.status(200).json({
    success: true,
    message: 'Attachment deleted successfully',
    data: medicalRecord,
  });
});

const getDoctorPatientDirectory = asyncHandler(async (req, res) => {
  if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only doctors or admins can access patient history');
  }

  const appointmentFilter = req.user.role === 'doctor' ? { doctor: req.user._id } : {};
  const appointments = await Appointment.find(appointmentFilter)
    .populate({ path: 'patient', select: 'firstName lastName email phone' })
    .select('patient appointmentDate')
    .sort({ appointmentDate: -1 });

  const patientMap = new Map();
  appointments.forEach((appointment) => {
    const patient = appointment.patient;
    if (!patient) {
      return;
    }

    const key = String(patient._id);
    const previous = patientMap.get(key);
    const visitDate = appointment.appointmentDate;

    if (!previous) {
      patientMap.set(key, {
        _id: patient._id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        appointmentCount: 1,
        lastAppointmentDate: visitDate,
      });
      return;
    }

    previous.appointmentCount += 1;
    if (!previous.lastAppointmentDate || new Date(visitDate) > new Date(previous.lastAppointmentDate)) {
      previous.lastAppointmentDate = visitDate;
    }
  });

  const search = String(req.query.search || '').trim().toLowerCase();
  const patients = Array.from(patientMap.values()).filter((patient) => {
    if (!search) {
      return true;
    }

    return [`${patient.firstName} ${patient.lastName}`, patient.email, patient.phone]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  });

  res.status(200).json({
    success: true,
    count: patients.length,
    data: patients,
  });
});

const getDoctorPatientHistory = asyncHandler(async (req, res) => {
  if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
    throw new ApiError(403, 'Only doctors or admins can access patient history');
  }

  const patient = await User.findById(req.params.patientId).select('firstName lastName email phone role');

  if (!patient || patient.role !== 'patient') {
    throw new ApiError(404, 'Patient not found');
  }

  const appointmentFilter = {
    patient: patient._id,
  };

  if (req.user.role === 'doctor') {
    appointmentFilter.doctor = req.user._id;
  }

  const appointments = await Appointment.find(appointmentFilter)
    .populate({ path: 'doctor', select: 'firstName lastName specialization' })
    .sort({ appointmentDate: -1 });

  if (req.user.role === 'doctor' && appointments.length === 0) {
    throw new ApiError(403, 'You can only view history for patients who had appointments with you');
  }

  const records = await MedicalRecord.find({
    patient: patient._id,
    ...(req.user.role === 'doctor' ? { doctor: req.user._id } : {}),
  })
    .populate(populateMedicalRecord)
    .sort({ createdAt: -1 });

  const visitSummary = appointments
    .slice()
    .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate))
    .map((appointment) => ({
      appointmentId: appointment._id,
      date: appointment.appointmentDate,
      tokenNumber: appointment.tokenNumber,
      session: appointment.appointmentSession,
      status: appointment.status,
    }));

  const vitalsSummary = records
    .filter(
      (record) =>
        record.clinicalVitals &&
        [
          record.clinicalVitals.temperatureCelsius,
          record.clinicalVitals.heartRate,
          record.clinicalVitals.oxygenSaturation,
          record.clinicalVitals.weightKg,
        ].some((value) => value !== null && value !== undefined)
    )
    .slice()
    .reverse()
    .map((record) => ({
      recordId: record._id,
      date: record.createdAt,
      temperatureCelsius: record.clinicalVitals.temperatureCelsius,
      heartRate: record.clinicalVitals.heartRate,
      oxygenSaturation: record.clinicalVitals.oxygenSaturation,
      weightKg: record.clinicalVitals.weightKg,
    }));

  res.status(200).json({
    success: true,
    data: {
      patient,
      visitSummary,
      vitalsSummary,
      records,
    },
  });
});

module.exports = {
  createMedicalRecord,
  getDoctorPatientDirectory,
  getDoctorPatientHistory,
  getMedicalRecords,
  getMedicalRecordById,
  updateMedicalRecord,
  archiveMedicalRecord,
  deleteMedicalRecord,
  uploadMedicalRecordAttachments,
  deleteMedicalRecordAttachment,
};
