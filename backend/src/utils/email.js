const nodemailer = require('nodemailer');
const ApiError = require('./ApiError');

const parseBoolean = (value) => String(value || '').trim().toLowerCase() === 'true';

const isEmailServiceConfigured = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.EMAIL_FROM_ADDRESS
  );

const getTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: parseBoolean(process.env.SMTP_SECURE),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

const getFromAddress = () => {
  const address = String(process.env.EMAIL_FROM_ADDRESS || '').trim();
  const name = String(process.env.EMAIL_FROM_NAME || 'Smart Clinic').trim();

  return name ? `"${name.replace(/"/g, '\\"')}" <${address}>` : address;
};

const sendEmail = async ({ to, subject, text, html }) => {
  if (!isEmailServiceConfigured()) {
    throw new ApiError(
      503,
      'Email service is not configured yet. Add SMTP settings to backend/.env before using forgot password.'
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

module.exports = {
  isEmailServiceConfigured,
  sendPasswordResetEmail,
};
