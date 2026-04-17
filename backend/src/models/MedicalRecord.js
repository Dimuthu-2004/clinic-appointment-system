const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    originalName: String,
    fileName: String,
    mimeType: String,
    size: Number,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const clinicalVitalsSchema = new mongoose.Schema(
  {
    bloodPressure: {
      type: String,
      trim: true,
      default: '',
    },
    heartRate: {
      type: Number,
      min: 1,
      max: 250,
      default: null,
    },
    respiratoryRate: {
      type: Number,
      min: 1,
      max: 80,
      default: null,
    },
    temperatureCelsius: {
      type: Number,
      min: 30,
      max: 45,
      default: null,
    },
    oxygenSaturation: {
      type: Number,
      min: 1,
      max: 100,
      default: null,
    },
    weightKg: {
      type: Number,
      min: 0.1,
      max: 400,
      default: null,
    },
    heightCm: {
      type: Number,
      min: 30,
      max: 300,
      default: null,
    },
  },
  { _id: false }
);

const medicalRecordSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    diagnosis: {
      type: String,
      required: true,
      trim: true,
    },
    symptoms: {
      type: String,
      trim: true,
      default: '',
    },
    treatmentPlan: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    clinicalVitals: {
      type: clinicalVitalsSchema,
      default: () => ({}),
    },
    attachments: [attachmentSchema],
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
