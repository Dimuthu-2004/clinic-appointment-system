export const isValidEmail = (value) => /\S+@\S+\.\S+/.test(String(value || '').trim());

export const isValidSriLankanPhone = (value) => /^(\+94|0)\d{9}$/.test(String(value || '').trim());

export const isValidSriLankanNic = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return /^\d{9}[VX]$/.test(normalized) || /^\d{12}$/.test(normalized);
};

export const passwordRequirementsMessage =
  'Use at least 8 characters with uppercase, lowercase, number, and special character.';

const buildPasswordChecks = (value) => {
  const password = String(value || '');

  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
};

export const getPasswordStrength = (value) => {
  const password = String(value || '');
  const checks = buildPasswordChecks(password);
  const score = Object.values(checks).filter(Boolean).length;

  let label = 'Too weak';

  if (!password) {
    label = 'Not set';
  } else if (score >= 5) {
    label = 'Strong';
  } else if (score === 4) {
    label = 'Good';
  } else if (score === 3) {
    label = 'Fair';
  } else {
    label = 'Weak';
  }

  return {
    checks,
    hasValue: password.length > 0,
    isStrong: Object.values(checks).every(Boolean),
    label,
    score,
  };
};

export const isStrongPassword = (value) => getPasswordStrength(value).isStrong;
