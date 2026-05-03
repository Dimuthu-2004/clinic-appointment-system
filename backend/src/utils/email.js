const nodemailer = require('nodemailer');
const ApiError = require('./ApiError');
const { isPlaceholderValue, normalizeEnvValue } = require('./env');

const parseBoolean = (value) => String(value || '').trim().toLowerCase() === 'true';

const normalizeSmtpPassword = (value) => normalizeEnvValue(value).replace(/\s+/g, '');

const isEmailPlaceholderValue = (value) =>
  isPlaceholderValue(value, ['your_email@example.com', 'your_email_app_password_or_smtp_key', 'replace_me']);

const isEmailServiceConfigured = () =>
  Boolean(
    normalizeEnvValue(process.env.SMTP_HOST) &&
      normalizeEnvValue(process.env.SMTP_PORT) &&
      !isEmailPlaceholderValue(process.env.SMTP_USER) &&
      !isEmailPlaceholderValue(process.env.SMTP_PASS) &&
      !isEmailPlaceholderValue(process.env.EMAIL_FROM_ADDRESS)
  );

const getTransporter = () =>
  nodemailer.createTransport({
    host: normalizeEnvValue(process.env.SMTP_HOST),
    port: Number(normalizeEnvValue(process.env.SMTP_PORT) || 587),
    secure: parseBoolean(process.env.SMTP_SECURE),
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    auth: {
      user: normalizeEnvValue(process.env.SMTP_USER),
      pass: normalizeSmtpPassword(process.env.SMTP_PASS),
    },
  });

const getFromAddress = () => {
  const address = normalizeEnvValue(process.env.EMAIL_FROM_ADDRESS);
  const name = normalizeEnvValue(process.env.EMAIL_FROM_NAME || 'Smart Clinic');

  return name ? `"${name.replace(/"/g, '\\"')}" <${address}>` : address;
};

const sendEmail = async ({ to, subject, text, html }) => {
  if (!isEmailServiceConfigured()) {
    throw new ApiError(
      503,
      'Email service is not configured on the server. Add real SMTP settings in Railway before using forgot password.'
    );
  }

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: getFromAddress(),
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    const smtpMessage = error?.message ? ` (${error.message})` : '';
    throw new ApiError(502, `Unable to send the password reset email right now${smtpMessage}`);
  }
};

const sendPasswordResetEmail = async ({ to, firstName, resetCode, expiresInMinutes }) => {
  const name = String(firstName || 'there').trim();
  const ttl = Number(expiresInMinutes || 15);
  const subject = 'Smart Clinic password reset code';
  const text = [
    `Hello ${name},`,
    '',
    `Your Smart Clinic password reset code is: ${resetCode}`,
    '',
    `This code will expire in ${ttl} minutes.`,
    '',
    'If you did not request this change, you can ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #10343c;">
      <h2 style="color: #0f766e;">Smart Clinic password reset</h2>
      <p>Hello ${name},</p>
      <p>Use the following verification code to reset your password:</p>
      <div style="font-size: 30px; font-weight: 800; letter-spacing: 6px; margin: 24px 0; color: #0f172a;">
        ${resetCode}
      </div>
      <p>This code will expire in ${ttl} minutes.</p>
      <p>If you did not request this change, you can ignore this email.</p>
    </div>
  `;

  await sendEmail({
    to,
    subject,
    text,
    html,
  });
};

const sendClinicAlertEmail = async ({ to, firstName, title, message }) => {
  const name = String(firstName || 'there').trim();
  const subject = `Smart Clinic alert: ${String(title || 'Clinic update').trim()}`;
  const text = [
    `Hello ${name},`,
    '',
    String(title || 'Clinic update').trim(),
    '',
    String(message || '').trim(),
    '',
    'Please open Smart Clinic for more details.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #10343c;">
      <h2 style="color: #0f766e;">Smart Clinic alert</h2>
      <p>Hello ${name},</p>
      <p style="font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 12px;">
        ${String(title || 'Clinic update').trim()}
      </p>
      <p style="line-height: 1.6;">${String(message || '').trim()}</p>
      <p>Please open Smart Clinic for more details.</p>
    </div>
  `;

  await sendEmail({
    to,
    subject,
    text,
    html,
  });
};

module.exports = {
  isEmailServiceConfigured,
  sendClinicAlertEmail,
  sendPasswordResetEmail,
};
