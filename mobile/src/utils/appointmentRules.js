export const PATIENT_CANCELLATION_NOTICE_MS = 6 * 60 * 60 * 1000;

const getAppointmentTimestamp = (appointmentDate) => {
  const timestamp = new Date(appointmentDate).getTime();
  return Number.isFinite(timestamp) ? timestamp : NaN;
};

export const getPatientCancellationState = (appointment) => {
  if (!appointment?.appointmentDate) {
    return {
      canCancel: false,
      reason: 'A valid appointment date is required before cancellation.',
    };
  }

  if (appointment.status === 'cancelled') {
    return {
      canCancel: false,
      reason: 'This appointment is already cancelled.',
    };
  }

  if (appointment.status === 'completed') {
    return {
      canCancel: false,
      reason: 'Completed appointments cannot be cancelled.',
    };
  }

  const remainingMs = getAppointmentTimestamp(appointment.appointmentDate) - Date.now();

  if (remainingMs < PATIENT_CANCELLATION_NOTICE_MS) {
    return {
      canCancel: false,
      reason: 'Appointments must be cancelled at least 6 hours before the scheduled time.',
    };
  }

  return {
    canCancel: true,
    reason: '',
  };
};

export const getDoctorStartState = (appointment) => {
  if (!appointment?.appointmentDate) {
    return {
      canStart: false,
      reason: 'A valid appointment date is required before starting.',
    };
  }

  if (appointment.status === 'cancelled') {
    return {
      canStart: false,
      reason: 'Cancelled appointments cannot be started.',
    };
  }

  if (appointment.status === 'completed') {
    return {
      canStart: false,
      reason: 'This appointment has already been finished.',
    };
  }

  return {
    canStart: true,
    reason: '',
  };
};
