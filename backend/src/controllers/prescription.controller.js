const Appointment = require('../models/Appointment');
const Drug = require('../models/Drug');
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ensureResourceAccess } = require('../utils/access');
const { createNotification, formatNotificationDateTime } = require('../utils/notifications');
const { getTodayDateKey, normalizeDateKey } = require('../utils/clinicSchedule');
const { buildPrescriptionPdfBuffer } = require('../utils/prescriptionPdf');

const populatePrescription = [
  { path: 'patient', select: 'firstName lastName email phone' },
  { path: 'doctor', select: 'firstName lastName specialization' },
  { path: 'appointment', select: 'appointmentDate appointmentSession tokenNumber reason status' },
];

const ensureLinkedAppointmentIsEditableToday = (appointment) => {
  if (!appointment?.appointmentDate) {
    return;
  }

  const appointmentDateKey = normalizeDateKey(appointment.appointmentDate);
  const todayDateKey = getTodayDateKey();

  if (!appointmentDateKey || appointmentDateKey !== todayDateKey) {
    throw new ApiError(
      422,
      'A prescription linked to an appointment can only be created or updated on that appointment date.'
    );
  }
};

const ensurePrescriptionActors = async ({ patientId, doctorId, appointmentId }) => {
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

    ensureLinkedAppointmentIsEditableToday(appointment);
  }

  return {
    patient,
    doctor,
    appointment,
  };
};

const createPrescription = asyncHandler(async (req, res) => {
  if (req.user.role !== 'doctor') {
    throw new ApiError(403, 'Only doctors can create prescriptions');
  }

  const payload = {
    ...req.body,
    doctor: req.user._id,
  };

  const actorContext = await ensurePrescriptionActors({
    patientId: payload.patient,
    doctorId: payload.doctor,
    appointmentId: payload.appointment,
  });

  const prescription = await Prescription.create(payload);
  const populatedPrescription = await Prescription.findById(prescription._id).populate(populatePrescription);

  await createNotification({
    recipientId: payload.patient,
    createdBy: req.user._id,
    type: 'general',
    title: 'New prescription available',
    message: actorContext.appointment?.appointmentDate
      ? `A prescription for your appointment on ${formatNotificationDateTime(actorContext.appointment.appointmentDate)} is now available.`
      : 'A new prescription is now available in your Smart Clinic account.',
    entityModel: 'Prescription',
    entityId: prescription._id,
    metadata: {
      prescriptionId: String(prescription._id),
      prescriptionPdfPath: `/prescriptions/${prescription._id}/pdf`,
      appointmentId: actorContext.appointment?._id ? String(actorContext.appointment._id) : '',
    },
  });

  res.status(201).json({
    success: true,
    message: 'Prescription created successfully',
    data: populatedPrescription,
  });
});

const getPrescriptions = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === 'patient') {
    filter.patient = req.user._id;
  }

  if (req.user.role === 'doctor') {
    filter.doctor = req.user._id;
  }

  const prescriptions = await Prescription.find(filter)
    .populate(populatePrescription)
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: prescriptions.length,
    data: prescriptions,
  });
});

const getPrescriptionById = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id).populate(populatePrescription);

  if (!prescription) {
    throw new ApiError(404, 'Prescription not found');
  }

  if (!ensureResourceAccess(req.user, prescription, ['patient', 'doctor'])) {
    throw new ApiError(403, 'You do not have access to this prescription');
  }

  res.status(200).json({
    success: true,
    data: prescription,
  });
});

const updatePrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    throw new ApiError(404, 'Prescription not found');
  }

  if (req.user.role !== 'doctor' || !ensureResourceAccess(req.user, prescription, ['doctor'])) {
    throw new ApiError(403, 'You do not have access to update this prescription');
  }

  const allowedFields = ['patient', 'doctor', 'appointment', 'medications', 'notes', 'status'];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      prescription[field] = req.body[field];
    }
  });

  await ensurePrescriptionActors({
    patientId: prescription.patient,
    doctorId: prescription.doctor,
    appointmentId: prescription.appointment,
  });

  await prescription.save();

  const updatedPrescription = await Prescription.findById(prescription._id).populate(populatePrescription);

  res.status(200).json({
    success: true,
    message: 'Prescription updated successfully',
    data: updatedPrescription,
  });
});

const deletePrescription = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id);

  if (!prescription) {
    throw new ApiError(404, 'Prescription not found');
  }

  if (req.user.role !== 'doctor' || !ensureResourceAccess(req.user, prescription, ['doctor'])) {
    throw new ApiError(403, 'You do not have access to delete this prescription');
  }

  await prescription.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Prescription deleted successfully',
  });
});

const getPrescriptionAvailability = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id).populate(populatePrescription);

  if (!prescription) {
    throw new ApiError(404, 'Prescription not found');
  }

  if (!ensureResourceAccess(req.user, prescription, ['patient', 'doctor'])) {
    throw new ApiError(403, 'You do not have access to this prescription');
  }

  const activeDrugs = await Drug.find({
    isActive: true,
    quantityInStock: { $gt: 0 },
  })
    .select('name genericName unitPrice quantityInStock strength dosageForm')
    .sort({ name: 1 });

  const matches = prescription.medications.map((medication) => {
    const normalizedMedicationName = String(medication.name || '').trim().toLowerCase();
    const matchingDrugs = activeDrugs.filter((drug) => {
      const candidateValues = [drug.name, drug.genericName]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase());

      return candidateValues.some(
        (value) =>
          value === normalizedMedicationName ||
          value.includes(normalizedMedicationName) ||
          normalizedMedicationName.includes(value)
      );
    });

    return {
      medicationName: medication.name,
      matches: matchingDrugs,
    };
  });

  res.status(200).json({
    success: true,
    data: {
      prescriptionId: prescription._id,
      matches,
    },
  });
});

const downloadPrescriptionPdf = asyncHandler(async (req, res) => {
  const prescription = await Prescription.findById(req.params.id).populate(populatePrescription);

  if (!prescription) {
    throw new ApiError(404, 'Prescription not found');
  }

  if (!ensureResourceAccess(req.user, prescription, ['patient', 'doctor'])) {
    throw new ApiError(403, 'You do not have access to this prescription');
  }

  const pdfBuffer = buildPrescriptionPdfBuffer(prescription);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="smart-clinic-prescription-${prescription._id}.pdf"`
  );
  res.setHeader('Content-Length', pdfBuffer.length);
  res.status(200).send(pdfBuffer);
});

module.exports = {
  createPrescription,
  getPrescriptions,
  getPrescriptionById,
  getPrescriptionAvailability,
  downloadPrescriptionPdf,
  updatePrescription,
  deletePrescription,
};
