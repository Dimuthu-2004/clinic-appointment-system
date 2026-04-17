const ApiError = require('../utils/ApiError');

const notFoundHandler = (req, _res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (error, _req, res, _next) => {
  if (error?.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'field';
    const fieldLabels = {
      email: 'email address',
      nic: 'NIC',
      slmcRegistrationNumber: 'SLMC registration number',
      googleId: 'Google account',
    };

    return res.status(409).json({
      success: false,
      message: `This ${fieldLabels[duplicateField] || duplicateField} is already in use`,
      details: {
        field: duplicateField,
        value: error.keyValue?.[duplicateField] ?? null,
      },
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    });
  }

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal server error',
    details: error.details || null,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
