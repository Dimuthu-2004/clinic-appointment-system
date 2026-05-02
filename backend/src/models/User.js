const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLE_VALUES, USER_ROLES } = require('../utils/roles');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    recoveryEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: undefined,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: USER_ROLES.PATIENT,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say'],
      default: 'prefer_not_to_say',
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    specialization: {
      type: String,
      trim: true,
      default: '',
    },
    appointmentFee: {
      amount: {
        type: Number,
        default: null,
        min: 0,
      },
      currency: {
        type: String,
        default: 'LKR',
        trim: true,
        uppercase: true,
      },
    },
    nic: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
    },
    slmcRegistrationNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined,
    },
    profileImage: {
      type: String,
      trim: true,
      default: '',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    passwordResetCodeHash: {
      type: String,
      select: false,
      default: '',
    },
    passwordResetExpiresAt: {
      type: Date,
      select: false,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    pushTokens: [
      {
        token: {
          type: String,
          required: true,
          trim: true,
        },
        platform: {
          type: String,
          trim: true,
          default: '',
        },
        deviceName: {
          type: String,
          trim: true,
          default: '',
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.passwordResetCodeHash;
        delete ret.passwordResetExpiresAt;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.index(
  { recoveryEmail: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recoveryEmail: { $type: 'string' },
    },
  }
);

userSchema.index(
  { nic: 1 },
  {
    unique: true,
    partialFilterExpression: {
      nic: { $type: 'string' },
    },
  }
);

userSchema.index(
  { slmcRegistrationNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      slmcRegistrationNumber: { $type: 'string' },
    },
  }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) {
    return;
  }

  if (!this.password) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
