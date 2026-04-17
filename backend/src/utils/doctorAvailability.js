const DoctorAvailability = require('../models/DoctorAvailability');
const { getClinicSessionsForDate, loadClinicScheduleFromDb, normalizeDateKey } = require('./clinicSchedule');

const buildDoctorSessionAvailability = ({ dateInput, overrides = [] }) => {
  const normalizedDateKey = normalizeDateKey(dateInput);
  const baseSessions = getClinicSessionsForDate(normalizedDateKey).map((item) => ({
    ...item,
    isAvailable: true,
  }));

  const fullDayOverride = overrides.find((item) => item.sessionScope === 'full_day');

  if (fullDayOverride) {
    const fullDayAvailability = fullDayOverride.availability === 'available';
    baseSessions.forEach((session) => {
      session.isAvailable = fullDayAvailability;
    });
  }

  baseSessions.forEach((session) => {
    const sessionOverride = overrides.find((item) => item.sessionScope === session.value);

    if (sessionOverride) {
      session.isAvailable = sessionOverride.availability === 'available';
    }
  });

  return baseSessions;
};

const getDoctorAvailabilityOverrides = async ({ doctorId, dateInput }) => {
  const normalizedDateKey = normalizeDateKey(dateInput);

  if (!normalizedDateKey) {
    return [];
  }

  return DoctorAvailability.find({ doctor: doctorId, dateKey: normalizedDateKey }).sort({ sessionScope: 1 });
};

const getDoctorSessionAvailability = async ({ doctorId, dateInput }) => {
  await loadClinicScheduleFromDb();
  const overrides = await getDoctorAvailabilityOverrides({ doctorId, dateInput });

  return buildDoctorSessionAvailability({
    dateInput,
    overrides,
  });
};

const isDoctorSessionAvailable = async ({ doctorId, dateInput, session }) => {
  const sessions = await getDoctorSessionAvailability({ doctorId, dateInput });
  return sessions.some((item) => item.value === session && item.isAvailable);
};

module.exports = {
  buildDoctorSessionAvailability,
  getDoctorAvailabilityOverrides,
  getDoctorSessionAvailability,
  isDoctorSessionAvailable,
};
