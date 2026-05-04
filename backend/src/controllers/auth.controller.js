const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { STAFF_ROLE_VALUES, USER_ROLES } = require('../utils/roles');
const { sendPasswordResetEmail } = require('../utils/email');
const {
  normalizeOptionalEmail,
  normalizeOptionalNic,
  normalizeOptionalSlmcRegistrationNumber,
  normalizeSpecialization,
} = require('../utils/validation');

const googleAuthClient = new OAuth2Client();
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

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
const buildGooglePlaceholderPassword = () => crypto.randomBytes(32).toString('hex');

const buildPasswordResetDeliveryTargets = (user) =>
  [user?.recoveryEmail, user?.email]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);

const clearPasswordResetState = (user) => {
  user.passwordResetCodeHash = '';
  user.passwordResetExpiresAt = null;
};

const buildEmailLookupQuery = (email, excludedUserId = null) => ({
  $or: [{ email }, { recoveryEmail: email }],
  ...(excludedUserId ? { _id: { $ne: excludedUserId } } : {}),
});

const ensurePrimaryEmailIsUnique = async (email, excludedUserId = null) => {
  const query = buildEmailLookupQuery(email, excludedUserId);
  const existingUser = await User.findOne(query);

  if (existingUser) {
    throw new ApiError(409, 'An account with this email already exists');
  }
};

const ensureRecoveryEmailIsUnique = async (email, excludedUserId = null) => {
  const query = buildEmailLookupQuery(email, excludedUserId);
  const existingUser = await User.findOne(query);

  if (existingUser) {
    throw new ApiError(409, 'This recovery email is already used by another account');
  }
};

const createUserAccount = async (payload) => {
  const email = payload.email.toLowerCase();
  await ensurePrimaryEmailIsUnique(email);
  const recoveryEmail = normalizeOptionalEmail(payload.recoveryEmail);

  const nic = normalizeOptionalNic(payload.nic);
  const slmcRegistrationNumber = normalizeOptionalSlmcRegistrationNumber(payload.slmcRegistrationNumber);

  const normalizedPayload = {
    ...payload,
    email,
    specialization: normalizeSpecialization(payload.specialization),
  };

  if (recoveryEmail && recoveryEmail !== email) {
    await ensureRecoveryEmailIsUnique(recoveryEmail);
    normalizedPayload.recoveryEmail = recoveryEmail;
  }

  if (nic !== undefined) {
    normalizedPayload.nic = nic;
  }

  if (slmcRegistrationNumber !== undefined) {
    normalizedPayload.slmcRegistrationNumber = slmcRegistrationNumber;
  }

  return User.create(normalizedPayload);
};

const parseConfiguredGoogleClientIds = () =>
  [
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
    ...String(process.env.GOOGLE_CLIENT_IDS || '')
      .split(',')
      .map((value) => value.trim()),
  ]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);

const splitGoogleDisplayName = ({ email, fullName, givenName, familyName }) => {
  const normalizedGivenName = String(givenName || '').trim();
  const normalizedFamilyName = String(familyName || '').trim();

  if (normalizedGivenName && normalizedFamilyName) {
    return {
      firstName: normalizedGivenName,
      lastName: normalizedFamilyName,
    };
  }

  const normalizedFullName = String(fullName || '').trim();

  if (normalizedFullName) {
    const [firstName, ...remainingParts] = normalizedFullName.split(/\s+/);

    return {
      firstName,
      lastName: remainingParts.join(' ').trim() || 'Google User',
    };
  }

  const fallbackName = String(email || '')
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .trim();
  const [firstName, ...remainingParts] = fallbackName.split(/\s+/).filter(Boolean);

  return {
    firstName: firstName || 'Google',
    lastName: remainingParts.join(' ').trim() || 'User',
  };
};

const verifyGoogleIdToken = async (idToken) => {
  const audiences = parseConfiguredGoogleClientIds();

  if (!audiences.length) {
    throw new ApiError(
      503,
      'Google sign-in is not configured. Add GOOGLE_ANDROID_CLIENT_ID and the matching mobile env value first.'
    );
  }

  let ticket;

  try {
    ticket = await googleAuthClient.verifyIdToken({
      idToken,
      audience: audiences,
    });
  } catch (_error) {
    throw new ApiError(401, 'Google sign-in could not be verified');
  }

  const payload = ticket.getPayload();
  const googleId = String(payload?.sub || '').trim();
  const email = String(payload?.email || '')
    .trim()
    .toLowerCase();
  const emailVerified = payload?.email_verified === true || payload?.email_verified === 'true';

  if (!googleId || !email || !emailVerified) {
    throw new ApiError(401, 'Google sign-in did not return a verified email address');
  }

  return {
    googleId,
    email,
    emailVerified,
    name: String(payload?.name || '').trim(),
    givenName: String(payload?.given_name || '').trim(),
    familyName: String(payload?.family_name || '').trim(),
  };
};

const fetchGoogleUserInfo = async (accessToken) => {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Google user info request failed');
  }

  return response.json();
};

const verifyGoogleAccessToken = async (accessToken) => {
  const audiences = parseConfiguredGoogleClientIds();

  if (!audiences.length) {
    throw new ApiError(
      503,
      'Google sign-in is not configured. Add GOOGLE_ANDROID_CLIENT_ID and the matching mobile env value first.'
    );
  }

  let tokenInfo;

  try {
    tokenInfo = await googleAuthClient.getTokenInfo(accessToken);
  } catch (_error) {
    throw new ApiError(401, 'Google sign-in could not be verified');
  }

  if (!audiences.includes(String(tokenInfo?.aud || '').trim())) {
    throw new ApiError(401, 'Google sign-in could not be verified');
  }

  const googleId = String(tokenInfo?.sub || tokenInfo?.user_id || '').trim();
  const email = String(tokenInfo?.email || '')
    .trim()
    .toLowerCase();
  const emailVerified =
    tokenInfo?.email_verified === true || tokenInfo?.email_verified === 'true';

  if (!googleId || !email || !emailVerified) {
    throw new ApiError(401, 'Google sign-in did not return a verified email address');
  }

  let profile = null;

  try {
    profile = await fetchGoogleUserInfo(accessToken);
  } catch (_error) {
    profile = null;
  }

  return {
    googleId,
    email,
    emailVerified,
    name: String(profile?.name || '').trim(),
    givenName: String(profile?.given_name || '').trim(),
    familyName: String(profile?.family_name || '').trim(),
  };
};

const resolveGoogleProfile = async ({ idToken, accessToken }) => {
  const normalizedIdToken = String(idToken || '').trim();
  const normalizedAccessToken = String(accessToken || '').trim();

  if (normalizedIdToken) {
    return verifyGoogleIdToken(normalizedIdToken);
  }

  if (normalizedAccessToken) {
    return verifyGoogleAccessToken(normalizedAccessToken);
  }

  throw new ApiError(400, 'Google ID token or access token is required');
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

const googleLogin = asyncHandler(async (req, res) => {
  const googleProfile = await resolveGoogleProfile({
    idToken: req.body.idToken,
    accessToken: req.body.accessToken,
  });

  let user = await User.findOne({
    $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }],
  });

  if (user) {
    if (user.role !== USER_ROLES.PATIENT) {
      throw new ApiError(
        403,
        'Google sign-in is only enabled for patient accounts in this app. Please use your usual login method.'
      );
    }

    if (user.googleId && user.googleId !== googleProfile.googleId) {
      throw new ApiError(409, 'This Google account is already linked to another patient account');
    }

    if (!user.googleId) {
      user.googleId = googleProfile.googleId;
      user.emailVerified = true;
      await user.save();
    }
  } else {
    await ensurePrimaryEmailIsUnique(googleProfile.email);

    const resolvedName = splitGoogleDisplayName({
      email: googleProfile.email,
      fullName: googleProfile.name,
      givenName: googleProfile.givenName,
      familyName: googleProfile.familyName,
    });

    user = await createUserAccount({
      firstName: resolvedName.firstName,
      lastName: resolvedName.lastName,
      email: googleProfile.email,
      password: buildGooglePlaceholderPassword(),
      phone: '',
      address: '',
      role: USER_ROLES.PATIENT,
      emailVerified: true,
      googleId: googleProfile.googleId,
    });
  }

  await stampLastLogin(user);

  res.status(200).json({
    success: true,
    message: 'Google sign-in successful',
    data: buildAuthResponse(user),
  });
});

const requestPasswordReset = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email }, { recoveryEmail: email }],
  }).select('+passwordResetCodeHash +passwordResetExpiresAt');

  if (!user) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[auth] Password reset requested for missing email: ${email}`);
    }

    res.status(200).json({
      success: true,
      message: 'If that email matches a Smart Clinic account, a password reset code will be sent shortly.',
    });
    return;
  }

  const resetCode = buildPasswordResetCode();
  const expiresInMinutes = getPasswordResetExpiryMinutes();
  const deliveryTargets = buildPasswordResetDeliveryTargets(user);

  user.passwordResetCodeHash = hashPasswordResetCode(resetCode);
  user.passwordResetExpiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  await sendPasswordResetEmail({
    to: deliveryTargets,
    firstName: user.firstName,
    resetCode,
    expiresInMinutes,
  });

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[auth] Password reset code email sent to: ${deliveryTargets.join(', ')} for account ${user.email}`);
  }

  res.status(200).json({
    success: true,
    message: 'If that email matches a Smart Clinic account, a password reset code will be sent shortly.',
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const resetCode = String(req.body.resetCode || '').trim();
  const user = await User.findOne({ $or: [{ email }, { recoveryEmail: email }] }).select(
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
    await ensurePrimaryEmailIsUnique(normalizedEmail, req.user._id);
    req.user.email = normalizedEmail;
  }

  if (req.body.recoveryEmail !== undefined) {
    const normalizedRecoveryEmail = normalizeOptionalEmail(req.body.recoveryEmail);
    const nextPrimaryEmail = String(req.user.email || '').trim().toLowerCase();

    if (normalizedRecoveryEmail && normalizedRecoveryEmail !== nextPrimaryEmail) {
      await ensureRecoveryEmailIsUnique(normalizedRecoveryEmail, req.user._id);
      req.user.recoveryEmail = normalizedRecoveryEmail;
    } else {
      req.user.recoveryEmail = undefined;
    }
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

  if (req.user.recoveryEmail && req.user.recoveryEmail === req.user.email) {
    req.user.recoveryEmail = undefined;
  }

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
  googleLogin,
  registerPatient,
  registerDoctor,
  registerStaff,
  getProfile,
  updateProfile,
};
