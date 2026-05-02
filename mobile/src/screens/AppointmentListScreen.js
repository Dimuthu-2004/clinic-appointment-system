import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import AppButton from '../components/AppButton';
import DateTimeField from '../components/DateTimeField';
import EmptyState from '../components/EmptyState';
import EntityCard from '../components/EntityCard';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { getTodayDateKey, toDateKey } from '../utils/clinicSchedule';
import { getDoctorStartState, getPatientCancellationState } from '../utils/appointmentRules';
import { formatDateOnly, formatDateTime } from '../utils/date';

const shiftMonth = (dateKey, amount) => {
  const baseDate = new Date(`${dateKey}T00:00:00`);
  return toDateKey(new Date(baseDate.getFullYear(), baseDate.getMonth() + amount, 1));
};

const getMonthLabel = (dateKey) => {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

const getPersonName = (person, fallback) => {
  if (!person || typeof person !== 'object') {
    return fallback;
  }

  const fullName = `${person.firstName || ''} ${person.lastName || ''}`.trim();
  return fullName || fallback;
};

export default function AppointmentListScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: themeColors, isDark } = useTheme();
  const isFocused = useIsFocused();
  const [appointments, setAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [billings, setBillings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDateKey());
  const [indicatorMonth, setIndicatorMonth] = useState(getTodayDateKey());
  const canCreateAppointment = user?.role === 'patient';
  const isDoctor = user?.role === 'doctor';
  const isPatient = user?.role === 'patient';

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        setLoading(true);
        const requests = [api.get('/appointments')];

        if (isDoctor) {
          requests.push(api.get('/medical-records'));
          requests.push(api.get('/billings'));
        }

        const [appointmentsResponse, recordsResponse, billingsResponse] = await Promise.all(requests);
        setAppointments(Array.isArray(appointmentsResponse?.data?.data) ? appointmentsResponse.data.data : []);
        setMedicalRecords(Array.isArray(recordsResponse?.data?.data) ? recordsResponse.data.data : []);
        setBillings(Array.isArray(billingsResponse?.data?.data) ? billingsResponse.data.data : []);
      } catch (error) {
        Alert.alert('Unable to load appointments', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (isFocused) {
      loadAppointments();
    }
  }, [isDoctor, isFocused]);

  const recordByAppointmentId = useMemo(() => {
    const map = new Map();
    medicalRecords.forEach((record) => {
      if (record.appointment?._id) {
        map.set(String(record.appointment._id), record);
      }
    });
    return map;
  }, [medicalRecords]);

  const billingByAppointmentId = useMemo(() => {
    const map = new Map();
    billings.forEach((billing) => {
      if (billing.appointment?._id) {
        map.set(String(billing.appointment._id), billing);
      }
    });
    return map;
  }, [billings]);

  const indicatorDates = useMemo(() => {
    const counts = new Map();

    appointments.forEach((appointment) => {
      const dateKey = toDateKey(appointment?.appointmentDate);

      if (!dateKey) {
        return;
      }

      counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
    });

    const monthPrefix = indicatorMonth.slice(0, 7);

    return [...counts.entries()]
      .filter(([dateKey]) => dateKey.startsWith(monthPrefix))
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([dateKey, count]) => ({ dateKey, count }));
  }, [appointments, indicatorMonth]);

  const filteredAppointments = useMemo(() => {
    if (!isDoctor) {
      return appointments;
    }

    return appointments.filter((appointment) => toDateKey(appointment?.appointmentDate) === selectedDate);
  }, [appointments, isDoctor, selectedDate]);

  const openMedicalRecordForm = (appointment, medicalRecord) => {
    navigation.navigate('MedicalRecordForm', {
      appointment,
      medicalRecord: medicalRecord || null,
      startMode: !medicalRecord,
    });
  };

  const handleCancelAppointment = async (appointment) => {
    const cancellationState = getPatientCancellationState(appointment);

    if (!cancellationState.canCancel) {
      Alert.alert('Cancellation unavailable', cancellationState.reason);
      return;
    }

    Alert.alert(
      'Cancel appointment',
      'Are you sure you want to cancel this appointment? This action cannot be undone.',
      [
        { text: 'Keep appointment', style: 'cancel' },
        {
          text: 'Cancel appointment',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.put(`/appointments/${appointment._id}`, {
                status: 'cancelled',
              });

              setAppointments((current) =>
                current.map((item) => (item._id === appointment._id ? response.data.data : item))
              );
              Alert.alert('Cancelled', 'Your appointment has been cancelled successfully.');
            } catch (error) {
              Alert.alert('Cancellation failed', error?.response?.data?.message || 'Unable to cancel appointment.');
            }
          },
        },
      ]
    );
  };

  const showStartBlockedReason = ({ linkedRecord, paymentCompleted, appointment }) => {
    if (linkedRecord) {
      openMedicalRecordForm(appointment, linkedRecord);
      return;
    }

    const startState = getDoctorStartState(appointment);

    if (!startState.canStart) {
      Alert.alert('Not available', startState.reason);
      return;
    }

    if (!paymentCompleted) {
      Alert.alert('Payment pending', 'Payment must be completed before the appointment can be started.');
    }
  };

  if (loading) {
    return <LoadingOverlay message="Loading appointments..." />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: themeColors.text }]}>Appointments</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
            {isDoctor
              ? 'Choose a date, then use the colored markers to jump to booked days quickly.'
              : isPatient
                ? 'Track your upcoming and past consultations, and cancel eligible appointments at least 6 hours early.'
                : 'Review booked appointments and manage patient visit flow.'}
          </Text>
        </View>
        {canCreateAppointment ? (
          <AppButton title="New" onPress={() => navigation.push('AppointmentForm')} />
        ) : null}
      </View>

      {isDoctor ? (
        <View style={[styles.calendarCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.calendarTitle, { color: themeColors.text }]}>Booked dates</Text>
          <Text style={[styles.calendarSubtitle, { color: themeColors.textMuted }]}>
            Keep the compact date picker, then jump with the colored markers below.
          </Text>
          <DateTimeField
            allowPastDates
            label="Selected date"
            mode="date"
            onChange={(dateKey) => {
              setSelectedDate(dateKey);
              setIndicatorMonth(dateKey);
            }}
            value={selectedDate}
          />

          <View style={styles.indicatorHeader}>
            <Text style={[styles.indicatorMonthLabel, { color: themeColors.primaryDark }]}>
              {getMonthLabel(indicatorMonth)}
            </Text>
            <View style={styles.indicatorActions}>
              <AppButton onPress={() => setIndicatorMonth(shiftMonth(indicatorMonth, -1))} title="Prev" variant="secondary" />
              <AppButton onPress={() => setIndicatorMonth(shiftMonth(indicatorMonth, 1))} title="Next" variant="secondary" />
            </View>
          </View>

          {indicatorDates.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.indicatorScroll}>
              <View style={styles.indicatorRow}>
                {indicatorDates.map((item) => {
                  const isSelected = item.dateKey === selectedDate;

                  return (
                    <Pressable
                      key={item.dateKey}
                      onPress={() => setSelectedDate(item.dateKey)}
                      style={[
                        styles.indicatorPill,
                        {
                          backgroundColor: isSelected
                            ? themeColors.primaryDark
                            : isDark
                              ? themeColors.surfaceMuted
                              : '#F8FBFC',
                          borderColor: isSelected ? themeColors.primaryDark : themeColors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.indicatorDot,
                          { backgroundColor: isSelected ? '#FCD34D' : themeColors.secondary },
                        ]}
                      />
                      <Text style={[styles.indicatorDate, { color: isSelected ? colors.surface : themeColors.text }]}>
                        {new Date(`${item.dateKey}T00:00:00`).getDate()}
                      </Text>
                      <Text
                        style={[
                          styles.indicatorCount,
                          { color: isSelected ? colors.surface : themeColors.textMuted },
                        ]}
                      >
                        {item.count} booked
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <Text style={[styles.indicatorEmpty, { color: themeColors.textMuted }]}>
              No booked appointment dates were found for this month.
            </Text>
          )}
        </View>
      ) : null}

      {filteredAppointments.length === 0 ? (
        <EmptyState
          message={isDoctor ? `No appointments are scheduled for ${formatDateOnly(selectedDate)}.` : 'No appointments have been added yet.'}
          title="No appointments yet"
        />
      ) : (
        filteredAppointments.map((appointment, index) => {
          const linkedRecord = recordByAppointmentId.get(String(appointment._id));
          const linkedBilling = billingByAppointmentId.get(String(appointment._id));
          const startState = isDoctor ? getDoctorStartState(appointment) : null;
          const paymentCompleted = Boolean(linkedBilling && linkedBilling.status === 'paid');
          const canStartAppointment = isDoctor && !linkedRecord && startState?.canStart && paymentCompleted;
          const footerHint = !isDoctor
            ? ''
            : linkedRecord
              ? 'This appointment has already been finished.'
              : !startState?.canStart
                ? startState?.reason || ''
                : !paymentCompleted
                  ? 'Payment must be completed before this appointment can start.'
                  : '';
          const cancellationState = isPatient ? getPatientCancellationState(appointment) : null;
          const patientName = getPersonName(appointment?.patient, 'Patient not available');
          const doctorName = getPersonName(appointment?.doctor, 'Doctor not available');
          const appointmentKey = String(
            appointment?._id || `${appointment?.appointmentDate || 'appointment'}-${appointment?.tokenNumber || index}`
          );

          return (
            <EntityCard
              key={appointmentKey}
              footer={
                isDoctor ? (
                  <View style={styles.footerActions}>
                    <AppButton
                      onPress={() =>
                        canStartAppointment || linkedRecord
                          ? openMedicalRecordForm(appointment, linkedRecord)
                          : showStartBlockedReason({ linkedRecord, paymentCompleted, appointment })
                      }
                      title={linkedRecord ? 'View record' : 'Start appointment'}
                      variant={canStartAppointment ? 'primary' : 'secondary'}
                    />
                    {!canStartAppointment && footerHint ? (
                      <Text style={[styles.footerHint, { color: themeColors.textMuted }]}>{footerHint}</Text>
                    ) : null}
                  </View>
                ) : isPatient ? (
                  <View style={styles.footerActions}>
                    <AppButton
                      disabled={!cancellationState?.canCancel}
                      onPress={() => handleCancelAppointment(appointment)}
                      title={cancellationState?.canCancel ? 'Cancel appointment' : 'Cancellation unavailable'}
                      variant={cancellationState?.canCancel ? 'danger' : 'secondary'}
                    />
                    {!cancellationState?.canCancel && cancellationState?.reason ? (
                      <Text style={[styles.footerHint, { color: themeColors.textMuted }]}>{cancellationState.reason}</Text>
                    ) : null}
                  </View>
                ) : null
              }
              meta={[
                `Date: ${formatDateTime(appointment.appointmentDate)}`,
                ...(appointment.tokenNumber ? [`Token: ${appointment.tokenNumber}`] : []),
                ...(isDoctor ? [`Patient: ${patientName}`] : []),
                ...(isPatient ? [`Doctor: ${doctorName === 'Doctor not available' ? doctorName : `Dr ${doctorName}`}`] : []),
                `Session: ${appointment.appointmentSession || 'Not set'}`,
                ...(isDoctor ? [`Payment: ${linkedBilling?.status || 'not created'}`] : []),
              ]}
              onPress={() =>
                isDoctor
                  ? canStartAppointment
                    ? openMedicalRecordForm(appointment, null)
                    : showStartBlockedReason({ linkedRecord, paymentCompleted, appointment })
                  : navigation.navigate('AppointmentForm', { appointment })
              }
              status={appointment.status}
              subtitle={
                isDoctor
                  ? `Patient: ${patientName}`
                  : `${formatDateTime(appointment.appointmentDate)} | Token ${appointment.tokenNumber || '-'}`
              }
              title={isDoctor ? `Token ${appointment.tokenNumber || '-'}` : 'Clinic appointment'}
            />
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  calendarCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  calendarTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  calendarSubtitle: {
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  indicatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  indicatorMonthLabel: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  indicatorActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  indicatorScroll: {
    marginTop: spacing.xs,
  },
  indicatorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.sm,
  },
  indicatorPill: {
    minWidth: 72,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginBottom: spacing.xs,
  },
  indicatorDate: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  indicatorCount: {
    color: colors.textMuted,
    fontSize: 11,
  },
  indicatorEmpty: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  footerActions: {
    gap: spacing.sm,
  },
  footerHint: {
    color: colors.textMuted,
    lineHeight: 20,
  },
});
