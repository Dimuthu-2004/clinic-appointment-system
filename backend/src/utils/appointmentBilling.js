const Billing = require('../models/Billing');
const AppSettings = require('../models/AppSettings');
const User = require('../models/User');

const DEFAULT_APPOINTMENT_FEE = {
  amount: Number(process.env.APPOINTMENT_FEE_AMOUNT || 2500),
  currency: process.env.APPOINTMENT_FEE_CURRENCY || 'LKR',
};

let runtimeAppointmentFee = { ...DEFAULT_APPOINTMENT_FEE };

const normalizeAppointmentFee = (fee = {}) => ({
  amount: Number(fee.amount ?? DEFAULT_APPOINTMENT_FEE.amount),
  currency: String(fee.currency || DEFAULT_APPOINTMENT_FEE.currency).trim().toUpperCase(),
});

const validateAppointmentFeePayload = (fee = {}) => {
  const amount = Number(fee.amount);
  const currency = String(fee.currency || '').trim();

  return Number.isFinite(amount) && amount > 0 && currency.length >= 3 && currency.length <= 6;
};

const setAppointmentFee = (fee) => {
  runtimeAppointmentFee = normalizeAppointmentFee(fee);
};

const loadAppointmentFeeFromDb = async () => {
  const settings = await AppSettings.findOne({}).select('appointmentFee');
  setAppointmentFee(settings?.appointmentFee || DEFAULT_APPOINTMENT_FEE);
  return runtimeAppointmentFee;
};

const getAppointmentFee = async (doctorId = null) => {
  if (doctorId) {
    const doctor = await User.findById(doctorId).select('appointmentFee');
    const doctorFeeAmount = Number(doctor?.appointmentFee?.amount);

    if (Number.isFinite(doctorFeeAmount) && doctorFeeAmount > 0) {
      return normalizeAppointmentFee(doctor.appointmentFee);
    }
  }

  return loadAppointmentFeeFromDb();
};
const getPaymentDueWindowMinutes = () => Number(process.env.PAYMENT_DUE_WINDOW_MINUTES || 30);

const buildPaymentDueDate = (appointmentDate) => (appointmentDate ? new Date(appointmentDate) : null);

const ensureBillingForAppointment = async ({ appointment, patientId, doctorId, paymentMethod = 'paypal' }) => {
  const existingBilling = await Billing.findOne({ appointment: appointment._id });

  if (existingBilling) {
    return existingBilling;
  }

  const appointmentFee = await getAppointmentFee(doctorId);

  return Billing.create({
    appointment: appointment._id,
    patient: patientId,
    doctor: doctorId,
    amount: appointmentFee.amount,
    currency: appointmentFee.currency,
    status: 'pending',
    paymentMethod,
    dueDate: buildPaymentDueDate(appointment.appointmentDate),
    notes: 'Payment must be completed before the doctor can start this appointment.',
  });
};

module.exports = {
  buildPaymentDueDate,
  DEFAULT_APPOINTMENT_FEE,
  ensureBillingForAppointment,
  getAppointmentFee,
  getPaymentDueWindowMinutes,
  loadAppointmentFeeFromDb,
  setAppointmentFee,
  validateAppointmentFeePayload,
};
