const isValidSriLankanNic = (value) => {
  if (!value) {
    return false;
  }

  const normalized = String(value).trim().toUpperCase();
  const oldNicPattern = /^\d{9}[VX]$/;
  const newNicPattern = /^\d{12}$/;

  return oldNicPattern.test(normalized) || newNicPattern.test(normalized);
};

const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';

const getPasswordChecks = (value) => {
  const password = String(value || '');

  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
};

const isStrongPassword = (value) => Object.values(getPasswordChecks(value)).every(Boolean);

const normalizeNic = (value) => String(value || '').trim().toUpperCase();
const normalizeOptionalNic = (value) => {
  const normalized = normalizeNic(value);
  return normalized || undefined;
};

const normalizeSpecialization = (value) => String(value || '').trim();
const normalizeOptionalSlmcRegistrationNumber = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized || undefined;
};

module.exports = {
  PASSWORD_REQUIREMENTS_MESSAGE,
  isStrongPassword,
  isValidSriLankanNic,
  normalizeNic,
  normalizeOptionalNic,
  normalizeSpecialization,
  normalizeOptionalSlmcRegistrationNumber,
};
