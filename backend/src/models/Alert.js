const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetedPatients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    minAge: {
      type: Number,
      default: null,
      min: 0,
    },
    maxAge: {
      type: Number,
      default: null,
      min: 1,
      max: 120,
    },
    ageLimit: {
      type: Number,
      default: null,
      min: 0,
    },
    targetCondition: {
      type: String,
      trim: true,
      default: '',
    },
    notificationsSentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Alert', alertSchema);
