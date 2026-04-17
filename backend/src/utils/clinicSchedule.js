const AppSettings = require('../models/AppSettings');

const CLINIC_TIMEZONE = 'Asia/Colombo';
const CLINIC_TIMEZONE_OFFSET = '+05:30';

const CLINIC_SESSION_TYPES = ['morning', 'evening'];
const AVAILABILITY_SESSION_SCOPES = ['morning', 'evening', 'full_day'];
const AVAILABILITY_STATUSES = ['available', 'unavailable'];

const DEFAULT_CLINIC_SCHEDULE = {
  weekday: {
    morning: {
      label: 'Morning',
      startTime: '06:00',
      endTime: '07:30',
    },
    evening: {
      label: 'Evening',
      startTime: '19:00',
      endTime: '22:00',
    },
  },
  saturday: {
    morning: {
      label: 'Morning',
      startTime: '06:30',
      endTime: '08:30',
    },
    evening: {
      label: 'Evening',
      startTime: '17:00',
      endTime: '22:00',
    },
  },
  sunday: {
    morning: {
      label: 'Morning',
      startTime: '08:00',
      endTime: '10:00',
    },
    evening: {
      label: 'Evening',
      startTime: '15:00',
      endTime: '20:00',
    },
  },
};

let runtimeClinicSchedule = DEFAULT_CLINIC_SCHEDULE;
let scheduleLoadedFromDb = false;

const clinicDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CLINIC_TIMEZONE,
  weekday: 'long',
});

const timeLabelFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const isDateKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
const isTimeKey = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '').trim());

const cloneSchedule = (schedule) => JSON.parse(JSON.stringify(schedule));

const normalizeDateKey = (value) => {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return '';
  }

  if (isDateKey(normalizedValue)) {
    return normalizedValue;
  }

  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return clinicDateFormatter.format(parsedDate);
};

const getTodayDateKey = () => clinicDateFormatter.format(new Date());

const isPastDateKey = (dateKey) => dateKey < getTodayDateKey();

const getDayBucket = (dateInput) => {
  const normalizedDateKey = normalizeDateKey(dateInput);

  if (!normalizedDateKey) {
    return null;
  }

  const dayName = weekdayFormatter.format(new Date(`${normalizedDateKey}T00:00:00${CLINIC_TIMEZONE_OFFSET}`));

  if (dayName === 'Saturday') {
    return 'saturday';
  }

  if (dayName === 'Sunday') {
    return 'sunday';
  }

  return 'weekday';
};

const formatTimeLabel = (time) => {
  const [hours, minutes] = String(time || '').split(':');
  const date = new Date(`2000-01-01T${hours}:${minutes}:00${CLINIC_TIMEZONE_OFFSET}`);
  return timeLabelFormatter.format(date);
};

const enrichSession = (session) => ({
  ...session,
  timeRange: `${formatTimeLabel(session.startTime)} - ${formatTimeLabel(session.endTime)}`,
});

const setClinicSchedule = (schedule) => {
  runtimeClinicSchedule = cloneSchedule(schedule || DEFAULT_CLINIC_SCHEDULE);
  scheduleLoadedFromDb = true;
  return getClinicSchedule();
};

const getClinicSchedule = () => cloneSchedule(runtimeClinicSchedule);

const getClinicSessionsForDate = (dateInput) => {
  const dayBucket = getDayBucket(dateInput);

  if (!dayBucket) {
    return [];
  }

  return CLINIC_SESSION_TYPES.map((sessionType) => ({
    value: sessionType,
    ...enrichSession(runtimeClinicSchedule[dayBucket][sessionType]),
  }));
};

const isClinicSessionAvailableForDate = (dateInput, session) =>
  getClinicSessionsForDate(dateInput).some((item) => item.value === session);

const buildAppointmentDate = (dateInput, session) => {
  const normalizedDateKey = normalizeDateKey(dateInput);
  const sessionConfig = getClinicSessionsForDate(normalizedDateKey).find((item) => item.value === session);

  if (!normalizedDateKey || !sessionConfig) {
    return null;
  }

  return new Date(`${normalizedDateKey}T${sessionConfig.startTime}:00${CLINIC_TIMEZONE_OFFSET}`);
};

const inferAppointmentSession = (appointmentDate) => {
  const normalizedDateKey = normalizeDateKey(appointmentDate);

  if (!normalizedDateKey) {
    return '';
  }

  const formattedTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLINIC_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(appointmentDate));

  const matchedSession = getClinicSessionsForDate(normalizedDateKey).find((item) => item.startTime === formattedTime);
  return matchedSession?.value || '';
};

const getClinicHoursList = () => [
  {
    key: 'weekday',
    label: 'Weekdays (Monday to Friday)',
    sessions: CLINIC_SESSION_TYPES.map((sessionType) => ({
      value: sessionType,
      ...enrichSession(runtimeClinicSchedule.weekday[sessionType]),
    })),
  },
  {
    key: 'saturday',
    label: 'Saturday',
    sessions: CLINIC_SESSION_TYPES.map((sessionType) => ({
      value: sessionType,
      ...enrichSession(runtimeClinicSchedule.saturday[sessionType]),
    })),
  },
  {
    key: 'sunday',
    label: 'Sunday',
    sessions: CLINIC_SESSION_TYPES.map((sessionType) => ({
      value: sessionType,
      ...enrichSession(runtimeClinicSchedule.sunday[sessionType]),
    })),
  },
];

const availabilityScopeOptions = [
  { label: 'Morning session', value: 'morning' },
  { label: 'Evening session', value: 'evening' },
  { label: 'Whole day', value: 'full_day' },
];

const validateClinicSchedulePayload = (schedule) => {
  const buckets = ['weekday', 'saturday', 'sunday'];

  for (const bucket of buckets) {
    for (const sessionType of CLINIC_SESSION_TYPES) {
      const session = schedule?.[bucket]?.[sessionType];

      if (!session?.label || !isTimeKey(session.startTime) || !isTimeKey(session.endTime)) {
        return false;
      }

      if (session.startTime >= session.endTime) {
        return false;
      }
    }
  }

  return true;
};

const loadClinicScheduleFromDb = async ({ force = false } = {}) => {
  if (scheduleLoadedFromDb && !force) {
    return getClinicSchedule();
  }

  const settings = await AppSettings.findOne().select('clinicSchedule').lean();

  if (settings?.clinicSchedule && validateClinicSchedulePayload(settings.clinicSchedule)) {
    runtimeClinicSchedule = cloneSchedule(settings.clinicSchedule);
  } else {
    runtimeClinicSchedule = cloneSchedule(DEFAULT_CLINIC_SCHEDULE);
  }

  scheduleLoadedFromDb = true;
  return getClinicSchedule();
};

module.exports = {
  AVAILABILITY_SESSION_SCOPES,
  AVAILABILITY_STATUSES,
  CLINIC_SESSION_TYPES,
  CLINIC_TIMEZONE_OFFSET,
  DEFAULT_CLINIC_SCHEDULE,
  availabilityScopeOptions,
  buildAppointmentDate,
  getClinicHoursList,
  getClinicSchedule,
  getClinicSessionsForDate,
  getDayBucket,
  getTodayDateKey,
  inferAppointmentSession,
  isClinicSessionAvailableForDate,
  isPastDateKey,
  loadClinicScheduleFromDb,
  normalizeDateKey,
  setClinicSchedule,
  validateClinicSchedulePayload,
};
