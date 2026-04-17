const Appointment = require('../models/Appointment');
const Billing = require('../models/Billing');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ensureResourceAccess } = require('../utils/access');
const { BILLING_MANAGER_ROLES } = require('../utils/roles');
const { buildInvoicePdfBuffer } = require('../utils/invoicePdf');
const {
  createNotification,
  ensurePendingPaymentReminderNotifications,
  formatNotificationDateTime,
} = require('../utils/notifications');

const populateBilling = [
  { path: 'patient', select: 'firstName lastName email phone' },
  { path: 'doctor', select: 'firstName lastName specialization' },
  {
    path: 'appointment',
    select: 'appointmentDate appointmentSession tokenNumber reason status',
  },
];

const canAccessBilling = (user, billing) =>
  user.role === 'admin' ||
  BILLING_MANAGER_ROLES.includes(user.role) ||
  ensureResourceAccess(user, billing, ['patient', 'doctor']);

const buildInvoiceMetadata = (billing) => ({
  billingId: String(billing._id),
  invoicePath: `/billings/${billing._id}/invoice.pdf`,
  amount: billing.amount,
  currency: billing.currency,
  paymentMethod: billing.paymentMethod,
});

const createBilling = asyncHandler(async (req, res) => {
  if (!BILLING_MANAGER_ROLES.includes(req.user.role)) {
    throw new ApiError(403, 'Only finance managers can create billing records');
  }

  const patient = await User.findById(req.body.patient);
  if (!patient || patient.role !== 'patient') {
    throw new ApiError(404, 'Patient not found');
  }

  const billingPayload = {
    ...req.body,
    doctor: req.body.doctor,
    paidAt: req.body.status === 'paid' ? new Date() : null,
  };

  if (!billingPayload.doctor) {
    throw new ApiError(400, 'Doctor is required');
  }

  if (billingPayload.appointment) {
    const appointment = await Appointment.findById(billingPayload.appointment);
    if (!appointment) {
      throw new ApiError(404, 'Linked appointment not found');
    }
  }

  const billing = await Billing.create(billingPayload);
  const populatedBilling = await Billing.findById(billing._id).populate(populateBilling);

  if (billing.status === 'paid') {
    await createNotification({
      recipientId: billing.patient,
      createdBy: req.user._id,
      type: 'payment',
      title: 'Bill ready',
      message: 'Your Smart Clinic bill is ready to download.',
      entityModel: 'Billing',
      entityId: billing._id,
      metadata: buildInvoiceMetadata(billing),
    });
  }

  res.status(201).json({
    success: true,
    message: 'Billing record created successfully',
    data: populatedBilling,
  });
});

const getBillings = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === 'patient') {
    filter.patient = req.user._id;
    await ensurePendingPaymentReminderNotifications(req.user._id);
  }

  if (req.user.role === 'doctor') {
    filter.doctor = req.user._id;
  }

  if (!['patient', 'doctor', 'admin', ...BILLING_MANAGER_ROLES].includes(req.user.role)) {
    throw new ApiError(403, 'You do not have access to billing records');
  }

  const billings = await Billing.find(filter).populate(populateBilling).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: billings.length,
    data: billings,
  });
});

const getBillingById = asyncHandler(async (req, res) => {
  const billing = await Billing.findById(req.params.id).populate(populateBilling);

  if (!billing) {
    throw new ApiError(404, 'Billing record not found');
  }

  if (!canAccessBilling(req.user, billing)) {
    throw new ApiError(403, 'You do not have access to this billing record');
  }

  res.status(200).json({
    success: true,
    data: billing,
  });
});

const updateBilling = asyncHandler(async (req, res) => {
  const billing = await Billing.findById(req.params.id);

  if (!billing) {
    throw new ApiError(404, 'Billing record not found');
  }

  if (!BILLING_MANAGER_ROLES.includes(req.user.role)) {
    throw new ApiError(403, 'Only finance managers can update billing records');
  }

  if (req.body.paymentMethod === 'paypal') {
    throw new ApiError(422, 'PayPal payments are updated automatically after checkout');
  }

  if (
    billing.paymentMethod === 'paypal' &&
    billing.status === 'paid' &&
    req.body.status !== undefined &&
    req.body.status !== 'paid'
  ) {
    throw new ApiError(422, 'Completed PayPal payments cannot be manually changed back to unpaid');
  }

  const allowedFields = ['status', 'paymentMethod', 'notes'];
  const previousStatus = billing.status;

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      billing[field] = req.body[field];
    }
  });

  if (billing.status === 'paid' && previousStatus !== 'paid' && billing.paymentMethod === 'paypal') {
    throw new ApiError(422, 'Use cash or card when finance confirms an in-clinic payment');
  }

  billing.paidAt = billing.status === 'paid' ? billing.paidAt || new Date() : null;
  await billing.save();

  const updatedBilling = await Billing.findById(billing._id).populate(populateBilling);

  if (billing.status === 'paid' && previousStatus !== 'paid') {
    const appointmentDate = updatedBilling.appointment?.appointmentDate;

    await createNotification({
      recipientId: billing.patient,
      createdBy: req.user._id,
      type: 'payment',
      title: 'Bill ready',
      message: appointmentDate
        ? `Your bill for the appointment on ${formatNotificationDateTime(appointmentDate)} is ready to download.`
        : 'Your Smart Clinic bill is ready to download.',
      entityModel: 'Billing',
      entityId: billing._id,
      metadata: buildInvoiceMetadata(billing),
    });
  }

  res.status(200).json({
    success: true,
    message: 'Billing record updated successfully',
    data: updatedBilling,
  });
});

const downloadBillingInvoice = asyncHandler(async (req, res) => {
  const billing = await Billing.findById(req.params.id).populate(populateBilling);

  if (!billing) {
    throw new ApiError(404, 'Billing record not found');
  }

  if (!canAccessBilling(req.user, billing)) {
    throw new ApiError(403, 'You do not have access to this billing invoice');
  }

  const pdfBuffer = buildInvoicePdfBuffer(billing);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="smart-clinic-bill-${billing._id}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.status(200).send(pdfBuffer);
});

const deleteBilling = asyncHandler(async (req, res) => {
  const billing = await Billing.findById(req.params.id);

  if (!billing) {
    throw new ApiError(404, 'Billing record not found');
  }

  if (!BILLING_MANAGER_ROLES.includes(req.user.role)) {
    throw new ApiError(403, 'Only finance managers can delete billing records');
  }

  await billing.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Billing record deleted successfully',
  });
});

module.exports = {
  createBilling,
  downloadBillingInvoice,
  getBillings,
  getBillingById,
  updateBilling,
  deleteBilling,
};
