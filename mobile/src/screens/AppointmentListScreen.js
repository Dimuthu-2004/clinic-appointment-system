import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
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
import { formatDateOnly, formatDateTime } from '../utils/date';

export default function AppointmentListScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const isFocused = useIsFocused();
  const [appointments, setAppointments] = useState([]);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [billings, setBillings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDateKey());
  const canCreateAppointment = user?.role === 'patient';
  const isDoctor = user?.role === 'doctor';

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
        setAppointments(appointmentsResponse.data.data);
        setMedicalRecords(recordsResponse?.data?.data || []);
        setBillings(billingsResponse?.data?.data || []);
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

  const filteredAppointments = useMemo(() => {
    if (!isDoctor) {
      return appointments;
    }

    return appointments.filter((appointment) => toDateKey(appointment.appointmentDate) === selectedDate);
  }, [appointments, isDoctor, selectedDate]);

  const openMedicalRecordForm = (appointment, medicalRecord) => {
    navigation.navigate('RecordsTab', {
      screen: 'MedicalRecordForm',
      params: {
        appointment,
        medicalRecord: medicalRecord || null,
        startMode: !medicalRecord,
      },
    });
  };

  const showStartBlockedReason = ({ linkedRecord, isTodayAppointment, paymentCompleted, appointment }) => {
    if (linkedRecord) {
      openMedicalRecordForm(appointment, linkedRecord);
      return;
    }

    if (appointment.status === 'completed') {
      Alert.alert('Appointment finished', 'This appointment is already completed.');
      return;
    }

    if (appointment.status === 'cancelled') {
      Alert.alert('Appointment cancelled', 'Cancelled appointments cannot be started.');
      return;
    }

    if (!isTodayAppointment) {
      Alert.alert('Not available', 'Doctors can only start appointments on the scheduled day.');
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
              ? 'Choose a date to see your appointment list, token order, and start that day\'s consultations.'
              : user?.role === 'patient'
                ? 'Track your upcoming and past consultations, and open any appointment for details.'
                : 'Review booked appointments and manage patient visit flow.'}
          </Text>
        </View>
        {canCreateAppointment ? (
          <AppButton title="New" onPress={() => navigation.push('AppointmentForm')} />
        ) : null}
      </View>

      {isDoctor ? (
        <View style={[styles.calendarCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.calendarTitle, { color: themeColors.text }]}>Appointment day</Text>
          <Text style={[styles.calendarSubtitle, { color: themeColors.textMuted }]}>Select a date to view only the appointments scheduled for that day.</Text>
          <DateTimeField
            allowPastDates
            label="Selected date"
            mode="date"
            onChange={setSelectedDate}
            value={selectedDate}
          />
        </View>
      ) : null}

      {filteredAppointments.length === 0 ? (
        <EmptyState
          message={isDoctor ? `No appointments are scheduled for ${formatDateOnly(selectedDate)}.` : 'No appointments have been added yet.'}
          title="No appointments yet"
        />
      ) : (
        filteredAppointments.map((appointment) => {
          const linkedRecord = recordByAppointmentId.get(String(appointment._id));
          const linkedBilling = billingByAppointmentId.get(String(appointment._id));
          const isTodayAppointment = isDoctor && toDateKey(appointment.appointmentDate) === getTodayDateKey();
          const paymentCompleted = Boolean(linkedBilling && linkedBilling.status === 'paid');
          const canStartAppointment =
            !linkedRecord &&
            isTodayAppointment &&
            appointment.status !== 'cancelled' &&
            appointment.status !== 'completed' &&
            paymentCompleted;
          const actionTitle = linkedRecord
            ? 'View record'
            : canStartAppointment
              ? 'Start appointment'
              : 'Start appointment';
          const footerHint = linkedRecord
            ? 'This appointment has already been finished.'
            : !paymentCompleted
            ? 'Payment must be completed before this appointment can start.'
            : appointment.status === 'completed'
            ? 'This appointment has already been finished.'
            : appointment.status === 'cancelled'
            ? 'Cancelled appointments cannot be started.'
            : !isTodayAppointment
            ? 'Doctors can only start appointments on the scheduled day.'
            : '';

          return (
            <EntityCard
              key={appointment._id}
              footer={
                isDoctor ? (
                  <View style={styles.footerActions}>
                    <AppButton
                      onPress={() =>
                        canStartAppointment || linkedRecord
                          ? openMedicalRecordForm(appointment, linkedRecord)
                          : showStartBlockedReason({ linkedRecord, isTodayAppointment, paymentCompleted, appointment })
                      }
                      title={actionTitle}
                      variant={canStartAppointment ? 'primary' : 'secondary'}
                    />
                    {!canStartAppointment && footerHint ? (
                      <Text style={[styles.footerHint, { color: themeColors.textMuted }]}>{footerHint}</Text>
                    ) : null}
                  </View>
                ) : null
              }
              meta={[
                `Date: ${formatDateTime(appointment.appointmentDate)}`,
                ...(appointment.tokenNumber ? [`Token: ${appointment.tokenNumber}`] : []),
                `Patient: ${appointment.patient?.firstName} ${appointment.patient?.lastName}`,
                `Session: ${appointment.appointmentSession || 'Not set'}`,
                `Payment: ${linkedBilling?.status || 'not created'}`,
              ]}
              onPress={() =>
                isDoctor
                  ? canStartAppointment
                    ? openMedicalRecordForm(appointment, null)
                    : showStartBlockedReason({ linkedRecord, isTodayAppointment, paymentCompleted, appointment })
                  : navigation.navigate('AppointmentForm', { appointment })
              }
              status={appointment.status}
              subtitle={
                isDoctor
                  ? `Patient: ${appointment.patient?.firstName} ${appointment.patient?.lastName}`
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
    padding: spacing.lg,
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
    marginBottom: spacing.md,
  },
  footerActions: {
    gap: spacing.sm,
  },
  footerHint: {
    color: colors.textMuted,
    lineHeight: 20,
  },
});
