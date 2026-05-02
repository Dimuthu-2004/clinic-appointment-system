const Billing = require('../models/Billing');
const ApiError = require('./ApiError');

const ensureDoctorCanStartAppointment = async ({ reqUser, appointment }) => {
  if (reqUser.role !== 'doctor' || !appointment) {
    return;
  }

  if (String(appointment.doctor) !== String(reqUser._id)) {
    throw new ApiError(403, 'You can only start appointments assigned to you');
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

module.exports = {
  ensureDoctorCanStartAppointment,
};
