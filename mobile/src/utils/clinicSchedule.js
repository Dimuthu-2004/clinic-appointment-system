const CLINIC_TIMEZONE_OFFSET = '+05:30';

const defaultClinicHours = [
  {
    key: 'weekday',
    label: 'Weekdays (Monday to Friday)',
    sessions: [
      { value: 'morning', label: 'Morning', timeRange: '6:00 AM - 7:30 AM', startTime: '06:00', endTime: '07:30' },
      { value: 'evening', label: 'Evening', timeRange: '7:00 PM - 10:00 PM', startTime: '19:00', endTime: '22:00' },
    ],
  },
  {
    key: 'saturday',
    label: 'Saturday',
    sessions: [
      { value: 'morning', label: 'Morning', timeRange: '6:30 AM - 8:30 AM', startTime: '06:30', endTime: '08:30' },
      { value: 'evening', label: 'Evening', timeRange: '5:00 PM - 10:00 PM', startTime: '17:00', endTime: '22:00' },
    ],
  },
  {
    key: 'sunday',
    label: 'Sunday',
    sessions: [
      { value: 'morning', label: 'Morning', timeRange: '8:00 AM - 10:00 AM', startTime: '08:00', endTime: '10:00' },
      { value: 'evening', label: 'Evening', timeRange: '3:00 PM - 8:00 PM', startTime: '15:00', endTime: '20:00' },
    ],
  },
];

let runtimeClinicHours = defaultClinicHours;

export const availabilityStatusOptions = [
  { label: 'Unavailable', value: 'unavailable' },
  { label: 'Available', value: 'available' },
];

export const availabilityScopeOptions = [
  { label: 'Morning session', value: 'morning' },
  { label: 'Evening session', value: 'evening' },
  { label: 'Whole day', value: 'full_day' },
];

export const setClinicHours = (clinicHours) => {
  if (Array.isArray(clinicHours) && clinicHours.length) {
    runtimeClinicHours = clinicHours;
  }
};

export const getClinicHours = () => runtimeClinicHours;

const pad = (value) => String(value).padStart(2, '0');

export const toDateKey = (value) => {
  if (!value) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    return String(value).trim();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const getTodayDateKey = () => toDateKey(new Date());

const getDayBucket = (dateInput) => {
  const dateKey = toDateKey(dateInput);

  if (!dateKey) {
    return '';
  }

  const dayIndex = new Date(`${dateKey}T00:00:00${CLINIC_TIMEZONE_OFFSET}`).getDay();

  if (dayIndex === 6) {
    return 'saturday';
  }

  if (dayIndex === 0) {
    return 'sunday';
  }

  return 'weekday';
};

export const getClinicSessionsForDate = (dateInput) => {
  const dayBucket = getDayBucket(dateInput);

  if (!dayBucket) {
    return [];
  }

  return runtimeClinicHours.find((item) => item.key === dayBucket)?.sessions || [];
};

export const buildAppointmentDateForSession = (dateInput, session) => {
  const dateKey = toDateKey(dateInput);
  const sessionConfig = getClinicSessionsForDate(dateKey).find((item) => item.value === session);

  if (!dateKey || !sessionConfig) {
    return '';
  }

  return new Date(`${dateKey}T${sessionConfig.startTime}:00${CLINIC_TIMEZONE_OFFSET}`).toISOString();
};

export const inferAppointmentSession = (appointmentDate) => {
  if (!appointmentDate) {
    return '';
  }

  const date = new Date(appointmentDate);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const timeKey = `${hours}:${minutes}`;

  return getClinicSessionsForDate(appointmentDate).find((item) => item.startTime === timeKey)?.value || '';
};

export const formatAvailabilityScope = (value) => {
  if (value === 'full_day') {
    return 'Whole day';
  }

  return value === 'morning' ? 'Morning session' : 'Evening session';
};
