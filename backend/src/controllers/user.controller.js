const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { USER_ROLES } = require('../utils/roles');
const {
  validateAppointmentFeePayload,
} = require('../utils/appointmentBilling');
const {
  normalizeOptionalNic,
  normalizeOptionalSlmcRegistrationNumber,
  normalizeSpecialization,
} = require('../utils/validation');

const listUsers = asyncHandler(async (req, res) => {
  const { role, search } = req.query;

  if (req.user.role === 'patient' && role !== 'doctor') {
    throw new ApiError(403, 'Patients can only browse doctor profiles');
  }

  const filter = {};

  if (role) {
    filter.role = role;
  }

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { specialization: { $regex: search, $options: 'i' } },
    ];
  }

  if (req.user.role === USER_ROLES.FINANCE_MANAGER) {
    filter.role = role || USER_ROLES.PATIENT;
  }

  if (req.user.role === USER_ROLES.PHARMACIST && !role) {
    filter.role = USER_ROLES.DOCTOR;
  }

  const users = await User.find(filter)
    .select('-password -__v')
    .sort({ firstName: 1, lastName: 1 });

  res.status(200).json({
    success: true,
    count: users.length,
    data: users,
  });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -__v');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

const createUser = asyncHandler(async (req, res) => {
  throw new ApiError(403, 'New accounts must be created from the registration flow');
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+password');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const allowedFields = [
    'firstName',
    'lastName',
    'email',
    'password',
    'role',
    'phone',
    'address',
    'gender',
    'dateOfBirth',
    'specialization',
    'appointmentFee',
    'nic',
    'slmcRegistrationNumber',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      if (field === 'email') {
        user[field] = String(req.body[field]).toLowerCase();
      } else if (field === 'nic') {
        user[field] = normalizeOptionalNic(req.body[field]);
      } else if (field === 'specialization') {
        user[field] = normalizeSpecialization(req.body[field]);
      } else if (field === 'slmcRegistrationNumber') {
        user[field] = normalizeOptionalSlmcRegistrationNumber(req.body[field]);
      } else if (field === 'appointmentFee') {
        if (user.role !== USER_ROLES.DOCTOR) {
          throw new ApiError(422, 'Appointment fee can only be assigned to doctors');
        }

        if (!validateAppointmentFeePayload(req.body[field])) {
          throw new ApiError(422, 'Doctor appointment fee must be greater than 0 and include a valid currency');
        }

        user[field] = {
          amount: Number(req.body[field].amount),
          currency: String(req.body[field].currency || 'LKR').trim().toUpperCase(),
        };
      } else {
        user[field] = req.body[field];
      }
    }
  });

  await user.save();

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: user,
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
});

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
