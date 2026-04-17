const ApiError = require('./ApiError');

const getPaypalBaseUrl = () =>
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const getPaypalCheckoutBaseUrl = () =>
  process.env.PAYPAL_MODE === 'live'
    ? 'https://www.paypal.com'
    : 'https://www.sandbox.paypal.com';

const isPaypalConfigured = () =>
  Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.SERVER_PUBLIC_URL);

const getPaypalSettlementCurrency = () => (process.env.PAYPAL_SETTLEMENT_CURRENCY || 'USD').toUpperCase();

const getPaypalLkrPerUsdRate = () => Number(process.env.PAYPAL_LKR_PER_USD || 300);

const buildPaypalCheckoutAmount = ({ amount, currency }) => {
  const normalizedAmount = Number(amount);
  const originalCurrency = String(currency || '').toUpperCase();
  const settlementCurrency = getPaypalSettlementCurrency();

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new ApiError(400, 'Invalid billing amount for PayPal checkout');
  }

  if (!originalCurrency) {
    throw new ApiError(400, 'Billing currency is missing');
  }

  if (originalCurrency === settlementCurrency) {
    return {
      amount: Number(normalizedAmount.toFixed(2)),
      currency: settlementCurrency,
      exchangeRate: 1,
    };
  }

  if (originalCurrency === 'LKR' && settlementCurrency === 'USD') {
    const lkrPerUsd = getPaypalLkrPerUsdRate();

    if (!Number.isFinite(lkrPerUsd) || lkrPerUsd <= 0) {
      throw new ApiError(500, 'PayPal currency conversion is not configured correctly');
    }

    return {
      amount: Number((normalizedAmount / lkrPerUsd).toFixed(2)),
      currency: settlementCurrency,
      exchangeRate: lkrPerUsd,
    };
  }

  throw new ApiError(400, `PayPal settlement does not support converting ${originalCurrency} to ${settlementCurrency}`);
};

const getPaypalAccessToken = async () => {
  if (!isPaypalConfigured()) {
    throw new ApiError(503, 'PayPal is not configured on the server');
  }

  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new ApiError(502, 'Unable to authenticate with PayPal');
  }

  const payload = await response.json();
  return payload.access_token;
};

const createPaypalOrder = async ({ accessToken, amount, currency, description, returnUrl, cancelUrl }) => {
  const response = await fetch(`${getPaypalBaseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          description,
          amount: {
            currency_code: currency,
            value: Number(amount).toFixed(2),
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: 'PAY_NOW',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new ApiError(502, 'Unable to create PayPal order');
  }

  return response.json();
};

const capturePaypalOrder = async ({ accessToken, orderId }) => {
  const response = await fetch(`${getPaypalBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new ApiError(502, 'Unable to capture PayPal payment');
  }

  return response.json();
};

module.exports = {
  buildPaypalCheckoutAmount,
  createPaypalOrder,
  capturePaypalOrder,
  getPaypalAccessToken,
  getPaypalCheckoutBaseUrl,
  isPaypalConfigured,
};
