const mongoose = require('mongoose');

const billingSchema = new mongoose.Schema(
  {
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
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
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'LKR',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'paypal'],
      default: 'cash',
    },
    dueDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    paypalOrderId: {
      type: String,
      trim: true,
      default: '',
    },
    paypalAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    paypalCurrency: {
      type: String,
      trim: true,
      default: '',
    },
    paypalExchangeRate: {
      type: Number,
      default: null,
      min: 0,
    },
    paypalCaptureId: {
      type: String,
      trim: true,
      default: '',
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Billing', billingSchema);
