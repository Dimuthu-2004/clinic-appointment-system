const mongoose = require('mongoose');

const sessionConfigSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    isOpen: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const clinicScheduleSchema = new mongoose.Schema(
  {
    weekday: {
      morning: { type: sessionConfigSchema, required: true },
      evening: { type: sessionConfigSchema, required: true },
    },
    saturday: {
      morning: { type: sessionConfigSchema, required: true },
      evening: { type: sessionConfigSchema, required: true },
    },
    sunday: {
      morning: { type: sessionConfigSchema, required: true },
      evening: { type: sessionConfigSchema, required: true },
    },
  },
  { _id: false }
);

const appSettingsSchema = new mongoose.Schema(
  {
    clinicSchedule: {
      type: clinicScheduleSchema,
      required: true,
    },
    appointmentFee: {
      amount: {
        type: Number,
        default: 2500,
        min: 0,
      },
      currency: {
        type: String,
        default: 'LKR',
        trim: true,
        uppercase: true,
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSettings', appSettingsSchema);
