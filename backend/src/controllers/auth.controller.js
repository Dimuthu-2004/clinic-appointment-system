const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { STAFF_ROLE_VALUES, USER_ROLES } = require('../utils/roles');
const { sendPasswordResetEmail } = require('../utils/email');
const {
  normalizeOptionalNic,
  normalizeOptionalSlmcRegistrationNumber,
  normalizeSpecialization,
} = require('../utils/validation');

const buildAuthResponse = (user) => {
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  return {
    token,
    user: user.toJSON(),
  };
};

const stampLastLogin = async (user) => {
  user.lastLoginAt = new Date();
  await user.save();
  return user;
};

const getPasswordResetExpiryMinutes = () =>
  Math.max(5, Number(process.env.PASSWORD_RESET_CODE_EXPIRES_MINUTES || 15));

const hashPasswordResetCode = (value) =>
  crypto.createHash('sha256').update(String(value || '')).digest('hex');

const buildPasswordResetCode = () => String(crypto.randomInt(100000, 1000000));

const clearPasswordResetState = (user) => {
  user.passwordResetCodeHash = '';
  user.passwordResetExpiresAt = null;
};

const ensureEmailIsUnique = async (email, excludedUserId = null) => {
  const query = excludedUserId ? { email, _id: { $ne: excludedUserId } } : { email };
  const existingUser = await User.findOne(query);

  if (existingUser) {
    throw new ApiError(409, 'An account with this email already exists');
  }
};

const createUserAccount = async (payload) => {
  const email = payload.email.toLowerCase();
  await ensureEmailIsUnique(email);

  const nic = normalizeOptionalNic(payload.nic);
  const slmcRegistrationNumber = normalizeOptionalSlmcRegistrationNumber(payload.slmcRegistrationNumber);

  const normalizedPayload = {
    ...payload,
    email,
    specialization: normalizeSpecialization(payload.specialization),
  };

  if (nic !== undefined) {
    normalizedPayload.nic = nic;
  }

  if (slmcRegistrationNumber !== undefined) {
    normalizedPayload.slmcRegistrationNumber = slmcRegistrationNumber;
  }

  return User.create(normalizedPayload);
};

const registerPatient = asyncHandler(async (req, res) => {
  const user = await createUserAccount({
    ...req.body,
    role: USER_ROLES.PATIENT,
  });
  await stampLastLogin(user);

  res.status(201).json({
    success: true,
    message: 'Patient account created successfully',
    data: buildAuthResponse(user),
  });
});

const registerDoctor = asyncHandler(async (req, res) => {
  const user = await createUserAccount({
    ...req.body,
    role: USER_ROLES.DOCTOR,
  });
  await stampLastLogin(user);

  res.status(201).json({
    success: true,
    message: 'Doctor account created successfully',
    data: buildAuthResponse(user),
  });
});

const registerStaff = asyncHandler(async (req, res) => {
  if (!STAFF_ROLE_VALUES.includes(req.body.role)) {
    throw new ApiError(422, 'Staff role must be finance_manager or pharmacist');
  }

  const user = await createUserAccount(req.body);
  await stampLastLogin(user);

  res.status(201).json({
    success: true,
    message: 'Staff account created successfully',
    data: buildAuthResponse(user),
  });
});

const login = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(req.body.password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  await stampLastLogin(user);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: buildAuthResponse(user),
  });
});

const requestPasswordReset = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({ email }).select('+passwordResetCodeHash +passwordResetExpiresAt');

  if (!user) {
    throw new ApiError(404, 'No Smart Clinic account was found for that email address');
  }

  const resetCode = buildPasswordResetCode();
  const expiresInMinutes = getPasswordResetExpiryMinutes();

  user.passwordResetCodeHash = hashPasswordResetCode(resetCode);
  user.passwordResetExpiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  await sendPasswordResetEmail({
    to: user.email,
    firstName: user.firstName,
    resetCode,
    expiresInMinutes,
  });

  res.status(200).json({
    success: true,
    message: 'A password reset code has been sent to your email address.',
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const resetCode = String(req.body.resetCode || '').trim();
  const user = await User.findOne({ email }).select(
    '+password +passwordResetCodeHash +passwordResetExpiresAt'
  );

  if (!user || !user.passwordResetCodeHash || !user.passwordResetExpiresAt) {
    throw new ApiError(400, 'The password reset code is invalid or has expired');
  }

  const expiresAt = new Date(user.passwordResetExpiresAt).getTime();
  const resetCodeMatches = hashPasswordResetCode(resetCode) === user.passwordResetCodeHash;

  if (!resetCodeMatches || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new ApiError(400, 'The password reset code is invalid or has expired');
  }

  user.password = req.body.password;
  clearPasswordResetState(user);
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Password reset successfully. You can now sign in with the new password.',
  });
});

const getProfile = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = [
    'firstName',
    'lastName',
    'email',
    'phone',
    'address',
    'gender',
    'dateOfBirth',
    'specialization',
    'nic',
    'slmcRegistrationNumber',
  ];

  if (req.body.email !== undefined) {
    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    await ensureEmailIsUnique(normalizedEmail, req.user._id);
    req.user.email = normalizedEmail;
  }

  allowedFields.forEach((field) => {
    if (field !== 'email' && req.body[field] !== undefined) {
      if (field === 'nic') {
        req.user[field] = normalizeOptionalNic(req.body[field]);
      } else if (field === 'specialization') {
        req.user[field] = normalizeSpecialization(req.body[field]);
      } else if (field === 'slmcRegistrationNumber') {
        req.user[field] = normalizeOptionalSlmcRegistrationNumber(req.body[field]);
      } else {
        req.user[field] = req.body[field];
      }
    }
  });

  await req.user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: req.user,
  });
});

module.exports = {
  requestPasswordReset,
  resetPassword,
  login,
  registerPatient,
  registerDoctor,
  registerStaff,
  getProfile,
  updateProfile,
};
