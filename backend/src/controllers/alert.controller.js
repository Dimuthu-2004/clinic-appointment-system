const Alert = require('../models/Alert');
const MedicalRecord = require('../models/MedicalRecord');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createNotification, ensurePendingPaymentReminderNotifications } = require('../utils/notifications');

const populateAlert = [
  { path: 'targetedPatients', select: 'firstName lastName email phone dateOfBirth' },
  { path: 'createdBy', select: 'firstName lastName role' },
];

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) {
    return null;
  }

  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
};

const normalizeOptionalAge = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const resolveAgeRange = ({ minAge, maxAge, ageLimit }) => {
  const normalizedMinAge = normalizeOptionalAge(minAge);
  const normalizedMaxAge = normalizeOptionalAge(maxAge);
  const legacyAgeLimit = normalizeOptionalAge(ageLimit);

  if (normalizedMinAge !== null || normalizedMaxAge !== null) {
    return {
      minAge: normalizedMinAge,
      maxAge: normalizedMaxAge,
    };
  }

  if (legacyAgeLimit !== null) {
    return {
      minAge: legacyAgeLimit,
      maxAge: null,
    };
  }

  return {
    minAge: null,
    maxAge: null,
  };
};

const normalizeSendToAll = (value) => value === true || value === 'true';

const hasTargetingFilters = ({ minAge, maxAge, ageLimit, targetCondition, sendToAll = false }) => {
  if (normalizeSendToAll(sendToAll)) {
    return true;
  }

  const resolvedAgeRange = resolveAgeRange({ minAge, maxAge, ageLimit });
  const normalizedCondition = String(targetCondition || '').trim();

  return resolvedAgeRange.minAge !== null || resolvedAgeRange.maxAge !== null || Boolean(normalizedCondition);
};

const getTargetPatientIds = async ({ minAge, maxAge, ageLimit, targetCondition, sendToAll = false }) => {
  const patients = await User.find({ role: 'patient' }).select('_id dateOfBirth');

  if (normalizeSendToAll(sendToAll)) {
    return patients.map((patient) => String(patient._id));
  }

  const resolvedAgeRange = resolveAgeRange({ minAge, maxAge, ageLimit });

  let filteredPatientIds = patients.map((patient) => String(patient._id));

  if (resolvedAgeRange.minAge !== null || resolvedAgeRange.maxAge !== null) {
    filteredPatientIds = patients
      .filter((patient) => {
        const age = calculateAge(patient.dateOfBirth);

        if (age === null) {
          return false;
        }

        if (resolvedAgeRange.minAge !== null && age < resolvedAgeRange.minAge) {
          return false;
        }

        if (resolvedAgeRange.maxAge !== null && age > resolvedAgeRange.maxAge) {
          return false;
        }

        return true;
      })
      .map((patient) => String(patient._id));
  }

  const normalizedCondition = String(targetCondition || '').trim();

  if (normalizedCondition) {
    const matchingRecords = await MedicalRecord.find({
      $or: [
        { diagnosis: { $regex: normalizedCondition, $options: 'i' } },
        { symptoms: { $regex: normalizedCondition, $options: 'i' } },
        { notes: { $regex: normalizedCondition, $options: 'i' } },
        { treatmentPlan: { $regex: normalizedCondition, $options: 'i' } },
      ],
    }).select('patient');

    const matchingPatientIds = new Set(matchingRecords.map((record) => String(record.patient)));
    filteredPatientIds = filteredPatientIds.filter((patientId) => matchingPatientIds.has(patientId));
  }

  if (resolvedAgeRange.minAge === null && resolvedAgeRange.maxAge === null && !normalizedCondition) {
    return [];
  }

  return filteredPatientIds;
};

const deliverAlertNotifications = async ({ alert, patientIds }) => {
  const uniquePatientIds = [...new Set(patientIds.map(String))];

  await Promise.all(
    uniquePatientIds.map(async (patientId) => {
      await createNotification({
        recipientId: patientId,
        createdBy: alert.createdBy,
        type: 'general',
        title: alert.title,
        message: alert.message,
        entityModel: 'Alert',
        entityId: alert._id,
        metadata: {
          alertId: String(alert._id),
          source: 'admin_alert',
          minAge: alert.minAge,
          maxAge: alert.maxAge,
          targetCondition: alert.targetCondition,
          sendToAll: alert.sendToAll,
        },
      });
    })
  );
};

const createAlert = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only admins can create alerts');
  }

  const sendToAll = normalizeSendToAll(req.body.sendToAll);

  if (
    !hasTargetingFilters({
      minAge: req.body.minAge,
      maxAge: req.body.maxAge,
      ageLimit: req.body.ageLimit,
      targetCondition: req.body.targetCondition,
      sendToAll,
    })
  ) {
    throw new ApiError(422, 'Choose an age limit or target condition, or select send to all users.');
  }

  const targetedPatientIds = await getTargetPatientIds({
    minAge: sendToAll ? null : req.body.minAge,
    maxAge: sendToAll ? null : req.body.maxAge,
    ageLimit: sendToAll ? null : req.body.ageLimit,
    targetCondition: sendToAll ? '' : req.body.targetCondition,
    sendToAll,
  });

  const resolvedAgeRange = resolveAgeRange({
    minAge: sendToAll ? null : req.body.minAge,
    maxAge: sendToAll ? null : req.body.maxAge,
    ageLimit: sendToAll ? null : req.body.ageLimit,
  });

  const alert = await Alert.create({
    title: String(req.body.title || '').trim(),
    message: String(req.body.message || '').trim(),
    minAge: resolvedAgeRange.minAge,
    maxAge: resolvedAgeRange.maxAge,
    ageLimit: null,
    targetCondition: sendToAll ? '' : String(req.body.targetCondition || '').trim(),
    sendToAll,
    status: req.body.status || 'active',
    createdBy: req.user._id,
    targetedPatients: targetedPatientIds,
    notificationsSentCount: targetedPatientIds.length,
  });

  if (alert.status === 'active' && targetedPatientIds.length) {
    await deliverAlertNotifications({
      alert,
      patientIds: targetedPatientIds,
    });
  }

  const populatedAlert = await Alert.findById(alert._id).populate(populateAlert);

  res.status(201).json({
    success: true,
    message: 'Alert created successfully',
    data: populatedAlert,
  });
});

const getAlerts = asyncHandler(async (req, res) => {
  if (req.user.role === 'patient') {
    await ensurePendingPaymentReminderNotifications(req.user._id);
  }

  const filter =
    req.user.role === 'patient'
      ? {
          targetedPatients: req.user._id,
        }
      : req.user.role === 'admin'
        ? {}
        : { _id: null };

  const alerts = await Alert.find(filter).populate(populateAlert).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: alerts.length,
    data: alerts,
  });
});

const getAlertById = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id).populate(populateAlert);

  if (!alert) {
    throw new ApiError(404, 'Alert not found');
  }

  if (
    req.user.role !== 'admin' &&
    !alert.targetedPatients?.some((patient) => String(patient?._id || patient) === String(req.user._id))
  ) {
    throw new ApiError(403, 'You do not have access to this alert');
  }

  res.status(200).json({
    success: true,
    data: alert,
  });
});

const updateAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    throw new ApiError(404, 'Alert not found');
  }

  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only admins can update alerts');
  }

  const allowedFields = ['title', 'message', 'minAge', 'maxAge', 'targetCondition', 'status'];
  const targetingChanged =
    req.body.minAge !== undefined ||
    req.body.maxAge !== undefined ||
    req.body.targetCondition !== undefined ||
    req.body.sendToAll !== undefined;

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      alert[field] =
        ['minAge', 'maxAge'].includes(field)
          ? req.body[field] === '' ? null : Number(req.body[field])
          : req.body[field];
    }
  });

  if (req.body.sendToAll !== undefined) {
    alert.sendToAll = normalizeSendToAll(req.body.sendToAll);
  }

  if (targetingChanged) {
    if (
      !hasTargetingFilters({
        minAge: alert.minAge,
        maxAge: alert.maxAge,
        ageLimit: alert.ageLimit,
        targetCondition: alert.targetCondition,
        sendToAll: alert.sendToAll,
      })
    ) {
      throw new ApiError(422, 'Choose an age limit or target condition, or select send to all users.');
    }

    if (alert.sendToAll) {
      alert.minAge = null;
      alert.maxAge = null;
      alert.targetCondition = '';
    }

    alert.ageLimit = null;
    const targetedPatientIds = await getTargetPatientIds({
      minAge: alert.minAge,
      maxAge: alert.maxAge,
      ageLimit: alert.ageLimit,
      targetCondition: alert.targetCondition,
      sendToAll: alert.sendToAll,
    });

    const previousPatientIds = new Set((alert.targetedPatients || []).map((patientId) => String(patientId)));
    const newlyAddedPatientIds = targetedPatientIds.filter((patientId) => !previousPatientIds.has(String(patientId)));

    alert.targetedPatients = targetedPatientIds;
    alert.notificationsSentCount = targetedPatientIds.length;

    if (alert.status === 'active' && newlyAddedPatientIds.length) {
      await deliverAlertNotifications({
        alert,
        patientIds: newlyAddedPatientIds,
      });
    }
  }

  await alert.save();

  const updatedAlert = await Alert.findById(alert._id).populate(populateAlert);

  res.status(200).json({
    success: true,
    message: 'Alert updated successfully',
    data: updatedAlert,
  });
});

const deleteAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);

  if (!alert) {
    throw new ApiError(404, 'Alert not found');
  }

  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only admins can delete alerts');
  }

  await alert.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Alert deleted successfully',
  });
});

module.exports = {
  createAlert,
  getAlerts,
  getAlertById,
  updateAlert,
  deleteAlert,
};
