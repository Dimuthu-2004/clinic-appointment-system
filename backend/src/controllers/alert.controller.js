const Alert = require('../models/Alert');
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { createNotification, ensurePendingPaymentReminderNotifications } = require('../utils/notifications');
const { isEmailServiceConfigured, sendClinicAlertEmail } = require('../utils/email');
const { hasFuzzyTextMatch, normalizeSearchText } = require('../utils/fuzzyTextMatch');

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
const normalizeSelectedPatientIds = (value) =>
  Array.isArray(value) ? [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))] : [];
const normalizeOptionalEndsAt = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const isAlertVisibleToPatients = (alert) => {
  const endsAt = alert?.endsAt ? new Date(alert.endsAt).getTime() : null;
  return !Number.isFinite(endsAt) || endsAt > Date.now();
};

const hasTargetingFilters = ({ minAge, maxAge, ageLimit, targetCondition, sendToAll = false }) => {
  if (normalizeSendToAll(sendToAll)) {
    return true;
  }

  const resolvedAgeRange = resolveAgeRange({ minAge, maxAge, ageLimit });
  const normalizedCondition = String(targetCondition || '').trim();

  return resolvedAgeRange.minAge !== null || resolvedAgeRange.maxAge !== null || Boolean(normalizedCondition);
};

const getTargetPatients = async ({ minAge, maxAge, ageLimit, targetCondition, sendToAll = false }) => {
  const patients = await User.find({ role: 'patient' }).select(
    '_id firstName lastName email recoveryEmail phone dateOfBirth'
  );

  if (normalizeSendToAll(sendToAll)) {
    return patients.map((patient) => ({
      ...patient.toObject(),
      calculatedAge: calculateAge(patient.dateOfBirth),
    }));
  }

  const resolvedAgeRange = resolveAgeRange({ minAge, maxAge, ageLimit });

  let filteredPatients = patients;

  if (resolvedAgeRange.minAge !== null || resolvedAgeRange.maxAge !== null) {
    filteredPatients = patients.filter((patient) => {
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
    });
  }

  const normalizedCondition = normalizeSearchText(targetCondition);

  if (normalizedCondition) {
    const candidatePatientIds = filteredPatients.map((patient) => patient._id);

    if (!candidatePatientIds.length) {
      return [];
    }

    const [matchingRecords, matchingAppointments] = await Promise.all([
      MedicalRecord.find({ patient: { $in: candidatePatientIds } }).select(
        'patient diagnosis symptoms notes treatmentPlan'
      ),
      Appointment.find({ patient: { $in: candidatePatientIds } }).select(
        'patient reason patientNotes doctorNotes'
      ),
    ]);

    const matchingPatientIds = new Set();

    matchingRecords.forEach((record) => {
      if (
        hasFuzzyTextMatch({
          query: normalizedCondition,
          texts: [record.diagnosis, record.symptoms, record.notes, record.treatmentPlan],
        })
      ) {
        matchingPatientIds.add(String(record.patient));
      }
    });

    matchingAppointments.forEach((appointment) => {
      if (
        hasFuzzyTextMatch({
          query: normalizedCondition,
          texts: [appointment.reason, appointment.patientNotes, appointment.doctorNotes],
        })
      ) {
        matchingPatientIds.add(String(appointment.patient));
      }
    });

    filteredPatients = filteredPatients.filter((patient) => matchingPatientIds.has(String(patient._id)));
  }

  if (resolvedAgeRange.minAge === null && resolvedAgeRange.maxAge === null && !normalizedCondition) {
    return [];
  }

  return filteredPatients.map((patient) => ({
    ...patient.toObject(),
    calculatedAge: calculateAge(patient.dateOfBirth),
  }));
};

const getResolvedTargetPatients = async ({
  minAge,
  maxAge,
  ageLimit,
  targetCondition,
  sendToAll = false,
  selectedPatientIds = [],
}) => {
  const matchedPatients = await getTargetPatients({
    minAge,
    maxAge,
    ageLimit,
    targetCondition,
    sendToAll,
  });

  const normalizedSelectedPatientIds = normalizeSelectedPatientIds(selectedPatientIds);

  if (normalizeSendToAll(sendToAll) || !normalizedSelectedPatientIds.length) {
    return matchedPatients;
  }

  const selectedSet = new Set(normalizedSelectedPatientIds);
  return matchedPatients.filter((patient) => selectedSet.has(String(patient._id)));
};

const deliverAlertNotifications = async ({ alert, patients = [] }) => {
  const uniquePatients = [...new Map(patients.map((patient) => [String(patient._id || patient), patient])).values()];

  if (alert.sendEmailNotifications && !isEmailServiceConfigured()) {
    throw new ApiError(503, 'Email service is not configured for alert emails. Add SMTP settings first.');
  }

  await Promise.all(
    uniquePatients.map(async (patient) => {
      const patientId = String(patient._id || patient);
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

      if (alert.sendEmailNotifications) {
        const destinationEmail = String(patient.recoveryEmail || patient.email || '').trim().toLowerCase();
        if (!destinationEmail) {
          return;
        }

        try {
          await sendClinicAlertEmail({
            to: destinationEmail,
            firstName: patient.firstName,
            title: alert.title,
            message: alert.message,
          });
        } catch (error) {
          console.warn(`[alert] Email delivery failed for ${destinationEmail}: ${error.message}`);
        }
      }
    })
  );
};

const previewAlertTargets = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    throw new ApiError(403, 'Only admins can preview alert targets');
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
    throw new ApiError(422, 'Choose an age limit or target condition before previewing targeted patients.');
  }

  const matchedPatients = await getResolvedTargetPatients({
    minAge: sendToAll ? null : req.body.minAge,
    maxAge: sendToAll ? null : req.body.maxAge,
    ageLimit: sendToAll ? null : req.body.ageLimit,
    targetCondition: sendToAll ? '' : req.body.targetCondition,
    sendToAll,
  });

  res.status(200).json({
    success: true,
    count: matchedPatients.length,
    data: matchedPatients,
  });
});

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

  const targetedPatients = await getResolvedTargetPatients({
    minAge: sendToAll ? null : req.body.minAge,
    maxAge: sendToAll ? null : req.body.maxAge,
    ageLimit: sendToAll ? null : req.body.ageLimit,
    targetCondition: sendToAll ? '' : req.body.targetCondition,
    sendToAll,
    selectedPatientIds: sendToAll ? [] : req.body.selectedPatientIds,
  });

  if (!targetedPatients.length) {
    throw new ApiError(422, 'No patients matched the selected audience. Preview and choose at least one patient.');
  }

  const targetedPatientIds = targetedPatients.map((patient) => String(patient._id));

  const resolvedAgeRange = resolveAgeRange({
    minAge: sendToAll ? null : req.body.minAge,
    maxAge: sendToAll ? null : req.body.maxAge,
    ageLimit: sendToAll ? null : req.body.ageLimit,
  });
  const endsAt = normalizeOptionalEndsAt(req.body.expiresAt);

  if (req.body.expiresAt !== undefined && !endsAt) {
    throw new ApiError(422, 'Closing date and time must be valid');
  }

  if (endsAt && endsAt.getTime() <= Date.now()) {
    throw new ApiError(422, 'Closing date and time must be in the future');
  }

  const alert = await Alert.create({
    title: String(req.body.title || '').trim(),
    message: String(req.body.message || '').trim(),
    minAge: resolvedAgeRange.minAge,
    maxAge: resolvedAgeRange.maxAge,
    ageLimit: null,
    targetCondition: sendToAll ? '' : String(req.body.targetCondition || '').trim(),
    endsAt,
    sendToAll,
    sendEmailNotifications: normalizeSendToAll(req.body.sendEmailNotifications),
    status: req.body.status || 'active',
    createdBy: req.user._id,
    targetedPatients: targetedPatientIds,
    notificationsSentCount: targetedPatientIds.length,
  });

  if (alert.status === 'active' && targetedPatientIds.length) {
    await deliverAlertNotifications({
      alert,
      patients: targetedPatients,
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

  let alerts = await Alert.find(filter).populate(populateAlert).sort({ createdAt: -1 });

  if (req.user.role === 'patient') {
    alerts = alerts.filter(isAlertVisibleToPatients);
  }

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

  if (req.user.role === 'patient' && !isAlertVisibleToPatients(alert)) {
    throw new ApiError(404, 'Alert not found');
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
    req.body.sendToAll !== undefined ||
    req.body.selectedPatientIds !== undefined;

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

  if (req.body.sendEmailNotifications !== undefined) {
    alert.sendEmailNotifications = normalizeSendToAll(req.body.sendEmailNotifications);
  }

  if (req.body.expiresAt !== undefined) {
    const endsAt = normalizeOptionalEndsAt(req.body.expiresAt);

    if (req.body.expiresAt && !endsAt) {
      throw new ApiError(422, 'Closing date and time must be valid');
    }

    if (endsAt && endsAt.getTime() <= Date.now()) {
      throw new ApiError(422, 'Closing date and time must be in the future');
    }

    alert.endsAt = endsAt;
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
    const targetedPatients = await getResolvedTargetPatients({
      minAge: alert.minAge,
      maxAge: alert.maxAge,
      ageLimit: alert.ageLimit,
      targetCondition: alert.targetCondition,
      sendToAll: alert.sendToAll,
      selectedPatientIds: alert.sendToAll ? [] : req.body.selectedPatientIds,
    });

    if (!targetedPatients.length) {
      throw new ApiError(422, 'No patients matched the selected audience. Preview and choose at least one patient.');
    }

    const targetedPatientIds = targetedPatients.map((patient) => String(patient._id));

    const previousPatientIds = new Set((alert.targetedPatients || []).map((patientId) => String(patientId)));
    const newlyAddedPatientIds = targetedPatientIds.filter((patientId) => !previousPatientIds.has(String(patientId)));
    const newlyAddedPatients = targetedPatients.filter((patient) =>
      newlyAddedPatientIds.includes(String(patient._id))
    );

    alert.targetedPatients = targetedPatientIds;
    alert.notificationsSentCount = targetedPatientIds.length;

    if (alert.status === 'active' && newlyAddedPatientIds.length) {
      await deliverAlertNotifications({
        alert,
        patients: newlyAddedPatients,
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
  previewAlertTargets,
  getAlerts,
  getAlertById,
  updateAlert,
  deleteAlert,
};
