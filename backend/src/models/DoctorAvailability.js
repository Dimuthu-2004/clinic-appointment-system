const mongoose = require('mongoose');
const {
  AVAILABILITY_SESSION_SCOPES,
  AVAILABILITY_STATUSES,
} = require('../utils/clinicSchedule');

const doctorAvailabilitySchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dateKey: {
      type: String,
      required: true,
      trim: true,
    },
    sessionScope: {
      type: String,
      enum: AVAILABILITY_SESSION_SCOPES,
      required: true,
    },
    availability: {
      type: String,
      enum: AVAILABILITY_STATUSES,
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

doctorAvailabilitySchema.index({ doctor: 1, dateKey: 1, sessionScope: 1 }, { unique: true });
doctorAvailabilitySchema.index({ doctor: 1, dateKey: 1 });

module.exports = mongoose.model('DoctorAvailability', doctorAvailabilitySchema);
