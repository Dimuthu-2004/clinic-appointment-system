const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
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
    appointmentDate: {
      type: Date,
      required: true,
    },
    appointmentSession: {
      type: String,
      enum: ['morning', 'evening'],
      default: '',
    },
    tokenNumber: {
      type: Number,
      default: null,
      min: 1,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    patientNotes: {
      type: String,
      trim: true,
      default: '',
    },
    doctorNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

appointmentSchema.index(
  { doctor: 1, appointmentDate: 1, appointmentSession: 1, tokenNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      tokenNumber: { $type: 'number' },
    },
  }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
