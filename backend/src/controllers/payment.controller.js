const Billing = require('../models/Billing');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ensureResourceAccess } = require('../utils/access');
const {
  buildPaypalCheckoutAmount,
  createPaypalOrder,
  capturePaypalOrder,
  getPaypalAccessToken,
  getPaypalCheckoutBaseUrl,
  isPaypalConfigured,
} = require('../utils/paypal');
const { createNotification, formatNotificationDateTime } = require('../utils/notifications');

const buildPaymentHtml = ({ title, message, statusColor }) => `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f2f7f8; margin: 0; padding: 24px; color: #10343c; }
      .card { max-width: 520px; margin: 60px auto; background: #ffffff; border-radius: 18px; padding: 28px; border: 1px solid #d4e3e7; }
      h1 { margin-top: 0; color: ${statusColor}; }
      p { line-height: 1.6; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
      <p>You can now return to the Smart Clinic app and refresh the Payments screen.</p>
    </div>
  </body>
</html>
`;

const createPaypalOrderForBilling = asyncHandler(async (req, res) => {
  if (!isPaypalConfigured()) {
    throw new ApiError(503, 'PayPal is not configured yet');
  }

  const billing = await Billing.findById(req.params.id)
    .populate({ path: 'appointment', select: 'appointmentDate appointmentSession tokenNumber' })
    .populate({ path: 'doctor', select: 'firstName lastName' });

  if (!billing) {
    throw new ApiError(404, 'Billing record not found');
  }

  if (!ensureResourceAccess(req.user, billing, ['patient'])) {
    throw new ApiError(403, 'You do not have access to this payment');
  }

  if (billing.status === 'paid') {
    throw new ApiError(400, 'This payment has already been completed');
  }

  if (billing.paymentMethod !== 'paypal') {
    throw new ApiError(400, 'This appointment is set for payment at the clinic counter');
  }

  const accessToken = await getPaypalAccessToken();
  const serverPublicUrl = process.env.SERVER_PUBLIC_URL.replace(/\/$/, '');
  const returnUrl = `${serverPublicUrl}/api/payments/paypal/return?billingId=${billing._id}`;
  const cancelUrl = `${serverPublicUrl}/api/payments/paypal/cancel?billingId=${billing._id}`;
  const description = `Clinic payment for appointment ${billing.appointment?._id || billing._id}`;
  const paypalCheckout = buildPaypalCheckoutAmount({
    amount: billing.amount,
    currency: billing.currency,
  });

  const order = await createPaypalOrder({
    accessToken,
    amount: paypalCheckout.amount,
    currency: paypalCheckout.currency,
    description,
    returnUrl,
    cancelUrl,
  });

  const approvalLink =
    order.links?.find((link) => link.rel === 'approve' || link.rel === 'payer-action')?.href ||
    order.payment_source?.paypal?.links?.find((link) => link.rel === 'approve' || link.rel === 'payer-action')?.href ||
    (order.id ? `${getPaypalCheckoutBaseUrl()}/checkoutnow?token=${order.id}` : '');

  if (!approvalLink) {
    throw new ApiError(502, 'PayPal did not return an approval link');
  }

  billing.paymentMethod = 'paypal';
  billing.paypalOrderId = order.id;
  billing.paypalAmount = paypalCheckout.amount;
  billing.paypalCurrency = paypalCheckout.currency;
  billing.paypalExchangeRate = paypalCheckout.exchangeRate;
  await billing.save();

  res.status(200).json({
    success: true,
    data: {
      approvalUrl: approvalLink,
      orderId: order.id,
      localAmount: billing.amount,
      localCurrency: billing.currency,
      checkoutAmount: paypalCheckout.amount,
      checkoutCurrency: paypalCheckout.currency,
    },
  });
});

const handlePaypalReturn = asyncHandler(async (req, res) => {
  const billing = await Billing.findById(req.query.billingId).populate({
    path: 'appointment',
    select: 'appointmentDate',
  });

  if (!billing) {
    return res
      .status(404)
      .send(buildPaymentHtml({ title: 'Payment not found', message: 'We could not find the related billing record.', statusColor: '#d14343' }));
  }

  if (billing.status === 'paid') {
    return res
      .status(200)
      .send(buildPaymentHtml({ title: 'Payment already captured', message: 'This payment was already completed earlier.', statusColor: '#1f8a5b' }));
  }

  const orderId = req.query.token || billing.paypalOrderId;

  if (!orderId) {
    return res
      .status(400)
      .send(buildPaymentHtml({ title: 'Missing order', message: 'PayPal did not return a valid order reference.', statusColor: '#d14343' }));
  }

  const accessToken = await getPaypalAccessToken();
  const capture = await capturePaypalOrder({
    accessToken,
    orderId,
  });

  const captureId =
    capture.purchase_units?.[0]?.payments?.captures?.[0]?.id || '';

  billing.status = 'paid';
  billing.paymentMethod = 'paypal';
  billing.paypalOrderId = orderId;
  billing.paypalCaptureId = captureId;
  billing.paidAt = new Date();
  await billing.save();

  await createNotification({
    recipientId: billing.patient,
    type: 'payment',
    title: 'Bill ready',
    message: billing.appointment?.appointmentDate
      ? `Your bill for the appointment on ${formatNotificationDateTime(billing.appointment.appointmentDate)} is ready to download.`
      : 'Your Smart Clinic bill is ready to download.',
    entityModel: 'Billing',
    entityId: billing._id,
    metadata: {
      billingId: String(billing._id),
      invoicePath: `/billings/${billing._id}/invoice.pdf`,
      paymentMethod: 'paypal',
      amount: billing.amount,
      currency: billing.currency,
    },
  });

  res
    .status(200)
    .send(buildPaymentHtml({ title: 'Payment successful', message: 'Your PayPal payment has been captured successfully.', statusColor: '#1f8a5b' }));
});

const handlePaypalCancel = asyncHandler(async (_req, res) => {
  res
    .status(200)
    .send(buildPaymentHtml({ title: 'Payment cancelled', message: 'The PayPal payment was cancelled before completion.', statusColor: '#d14343' }));
});

module.exports = {
  createPaypalOrderForBilling,
  handlePaypalCancel,
  handlePaypalReturn,
};
