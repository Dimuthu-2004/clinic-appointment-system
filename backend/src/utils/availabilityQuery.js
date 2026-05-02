const User = require('../models/User');
const { CLINIC_TIMEZONE_OFFSET, getTodayDateKey, normalizeDateKey } = require('./clinicSchedule');
const { getDoctorSessionAvailability } = require('./doctorAvailability');

const SESSION_LABELS = {
  morning: 'morning',
  evening: 'evening',
};

const WEEKDAY_INDEX = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const buildDateKeyWithOffset = (date) => normalizeDateKey(new Date(date));

const addDaysToDateKey = (dateKey, days) => {
  const baseDate = new Date(`${dateKey}T00:00:00${CLINIC_TIMEZONE_OFFSET}`);
  baseDate.setDate(baseDate.getDate() + days);
  return buildDateKeyWithOffset(baseDate);
};

const resolveNextWeekdayDateKey = (weekday, modifier = '') => {
  const weekdayIndex = WEEKDAY_INDEX[weekday];

  if (weekdayIndex === undefined) {
    return '';
  }

  const todayDateKey = getTodayDateKey();
  const today = new Date(`${todayDateKey}T00:00:00${CLINIC_TIMEZONE_OFFSET}`);
  const todayIndex = today.getDay();
  let daysUntilTarget = (weekdayIndex - todayIndex + 7) % 7;

  if (modifier === 'next') {
    daysUntilTarget = daysUntilTarget === 0 ? 7 : daysUntilTarget + 7;
  } else if (daysUntilTarget === 0) {
    daysUntilTarget = 7;
  }

  return addDaysToDateKey(todayDateKey, daysUntilTarget);
};

const parseDateKeyFromMessage = (message) => {
  const normalizedMessage = String(message || '').toLowerCase();

  const isoMatch = normalizedMessage.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) {
    return {
      dateKey: normalizeDateKey(isoMatch[0]),
      source: 'explicit',
    };
  }

  const slashMatch = normalizedMessage.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/);
  if (slashMatch) {
    return {
      dateKey: normalizeDateKey(slashMatch[0]),
      source: 'explicit',
    };
  }

  if (/\bday after tomorrow\b/.test(normalizedMessage)) {
    return {
      dateKey: addDaysToDateKey(getTodayDateKey(), 2),
      source: 'relative',
    };
  }

  if (/\btomorrow\b/.test(normalizedMessage)) {
    return {
      dateKey: addDaysToDateKey(getTodayDateKey(), 1),
      source: 'relative',
    };
  }

  if (/\btoday\b|\bthis (morning|evening|afternoon|night)\b|\btonight\b/.test(normalizedMessage)) {
    return {
      dateKey: getTodayDateKey(),
      source: 'relative',
    };
  }

  const weekdayMatch = normalizedMessage.match(/\b(?:(next)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    return {
      dateKey: resolveNextWeekdayDateKey(weekdayMatch[2], weekdayMatch[1] || ''),
      source: 'relative',
    };
  }

  return {
    dateKey: getTodayDateKey(),
    source: 'defaulted',
  };
};

const parseSessionFromMessage = (message) => {
  const normalizedMessage = String(message || '').toLowerCase();

  if (/\bmorning\b/.test(normalizedMessage)) {
    return 'morning';
  }

  if (/\bevening\b|\btonight\b|\bafternoon\b|\bnight\b/.test(normalizedMessage)) {
    return 'evening';
  }

  return '';
};

const extractDoctorSearchText = (message) => {
  let cleaned = ` ${String(message || '').toLowerCase()} `;

  const cleanupPatterns = [
    /\bday after tomorrow\b/g,
    /\btomorrow\b/g,
    /\btoday\b/g,
    /\btonight\b/g,
    /\bthis (morning|evening|afternoon|night)\b/g,
    /\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    /\b(morning|evening|afternoon|night)\b/g,
    /\b(is|are|was|were|can|could|would|will|please|check|tell|me|whether|if|doctor|doctors|dr|available|availability|free|open|book|booking|appointment|appointments|for|on|at|in|the|a|an|my|our|show|find|look|up|to)\b/g,
    /[^\p{L}\p{N}\s-]/gu,
  ];

  cleanupPatterns.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, ' ');
  });

  return cleaned.replace(/\s+/g, ' ').trim();
};

const buildDoctorMatchScore = (doctor, doctorSearchText) => {
  const query = String(doctorSearchText || '').trim().toLowerCase();

  if (!query) {
    return 0;
  }

  const firstName = String(doctor.firstName || '').trim().toLowerCase();
  const lastName = String(doctor.lastName || '').trim().toLowerCase();
  const fullName = `${firstName} ${lastName}`.trim();
  const queryTokens = query.split(' ').filter(Boolean);

  if (fullName === query) {
    return 100;
  }

  if (firstName === query || lastName === query) {
    return 94;
  }

  if (fullName.startsWith(query)) {
    return 88;
  }

  if (queryTokens.length > 1 && queryTokens.every((token) => fullName.includes(token))) {
    return 82;
  }

  if (fullName.includes(query)) {
    return 72;
  }

  if (queryTokens.some((token) => firstName.startsWith(token) || lastName.startsWith(token))) {
    return 60;
  }

  return 0;
};

const resolveDoctorMatch = async (doctorSearchText) => {
  if (!doctorSearchText) {
    return {
      doctor: null,
      suggestions: [],
      ambiguity: 'missing',
    };
  }

  const doctors = await User.find({ role: 'doctor' })
    .select('firstName lastName specialization')
    .sort({ firstName: 1, lastName: 1 })
    .lean();

  const scoredMatches = doctors
    .map((doctor) => ({
      ...doctor,
      score: buildDoctorMatchScore(doctor, doctorSearchText),
    }))
    .filter((doctor) => doctor.score > 0)
    .sort((left, right) => right.score - left.score || left.firstName.localeCompare(right.firstName));

  if (!scoredMatches.length) {
    return {
      doctor: null,
      suggestions: [],
      ambiguity: 'not_found',
    };
  }

  const [topMatch, secondMatch] = scoredMatches;
  const confidentUniqueMatch =
    !secondMatch ||
    topMatch.score >= 100 ||
    topMatch.score - secondMatch.score >= 15;

  if (!confidentUniqueMatch) {
    return {
      doctor: null,
      suggestions: scoredMatches.slice(0, 5),
      ambiguity: 'multiple',
    };
  }

  return {
    doctor: topMatch,
    suggestions: scoredMatches.slice(0, 5),
    ambiguity: '',
  };
};

const formatDoctorLabel = (doctor) => `Dr ${doctor.firstName} ${doctor.lastName}`;

const formatSessionList = (sessions) =>
  sessions.map((session) => SESSION_LABELS[session.value] || session.label || session.value).join(' and ');

const resolveDoctorAvailabilityQuestion = async (message) => {
  const parsedDate = parseDateKeyFromMessage(message);
  const parsedSession = parseSessionFromMessage(message);
  const doctorSearchText = extractDoctorSearchText(message);
  const matchResult = await resolveDoctorMatch(doctorSearchText);

  if (matchResult.ambiguity === 'missing') {
    return {
      available: null,
      answer: 'Please include the doctor name, for example: Is Dr Shanaka available today?',
      parsed: {
        doctorSearchText,
        dateKey: parsedDate.dateKey,
        dateSource: parsedDate.source,
        session: parsedSession || null,
      },
      doctor: null,
      suggestions: [],
    };
  }

  if (matchResult.ambiguity === 'not_found') {
    return {
      available: null,
      answer: `I couldn't find a doctor matching "${doctorSearchText}". Try the full name as shown in the booking page.`,
      parsed: {
        doctorSearchText,
        dateKey: parsedDate.dateKey,
        dateSource: parsedDate.source,
        session: parsedSession || null,
      },
      doctor: null,
      suggestions: [],
    };
  }

  if (matchResult.ambiguity === 'multiple') {
    const suggestionText = matchResult.suggestions.map(formatDoctorLabel).join(', ');

    return {
      available: null,
      answer: `I found multiple doctors matching "${doctorSearchText}": ${suggestionText}. Please use the full name.`,
      parsed: {
        doctorSearchText,
        dateKey: parsedDate.dateKey,
        dateSource: parsedDate.source,
        session: parsedSession || null,
      },
      doctor: null,
      suggestions: matchResult.suggestions,
    };
  }

  const doctor = matchResult.doctor;
  const sessions = await getDoctorSessionAvailability({
    doctorId: doctor._id,
    dateInput: parsedDate.dateKey,
  });

  if (!parsedSession) {
    const availableSessions = sessions.filter((session) => session.isAvailable);

    if (!availableSessions.length) {
      return {
        available: false,
        answer: `${formatDoctorLabel(doctor)} is not available on ${parsedDate.dateKey}.`,
        parsed: {
          doctorSearchText,
          dateKey: parsedDate.dateKey,
          dateSource: parsedDate.source,
          session: null,
        },
        doctor,
        suggestions: matchResult.suggestions,
      };
    }

    return {
      available: true,
      answer: `${formatDoctorLabel(doctor)} is available on ${parsedDate.dateKey} for the ${formatSessionList(availableSessions)} session${availableSessions.length > 1 ? 's' : ''}.`,
      parsed: {
        doctorSearchText,
        dateKey: parsedDate.dateKey,
        dateSource: parsedDate.source,
        session: null,
      },
      doctor,
      suggestions: matchResult.suggestions,
      sessions,
    };
  }

  const sessionAvailability = sessions.find((session) => session.value === parsedSession);

  if (!sessionAvailability) {
    return {
      available: null,
      answer: `I couldn't find a clinic ${parsedSession} session on ${parsedDate.dateKey}.`,
      parsed: {
        doctorSearchText,
        dateKey: parsedDate.dateKey,
        dateSource: parsedDate.source,
        session: parsedSession,
      },
      doctor,
      suggestions: matchResult.suggestions,
      sessions,
    };
  }

  return {
    available: sessionAvailability.isAvailable,
    answer: sessionAvailability.isAvailable
      ? `${formatDoctorLabel(doctor)} is available on ${parsedDate.dateKey} for the ${SESSION_LABELS[parsedSession]} session.`
      : `${formatDoctorLabel(doctor)} is not available on ${parsedDate.dateKey} for the ${SESSION_LABELS[parsedSession]} session.`,
    parsed: {
      doctorSearchText,
      dateKey: parsedDate.dateKey,
      dateSource: parsedDate.source,
      session: parsedSession,
    },
    doctor,
    suggestions: matchResult.suggestions,
    sessions,
  };
};

module.exports = {
  resolveDoctorAvailabilityQuestion,
};
