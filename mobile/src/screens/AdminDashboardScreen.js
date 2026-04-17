import { useEffect, useMemo, useState } from 'react';
import { Alert, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppSelect from '../components/AppSelect';
import DashboardTopBar from '../components/DashboardTopBar';
import DateTimeField from '../components/DateTimeField';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, shadow, spacing, useTheme } from '../theme';
import { getTodayDateKey, toDateKey } from '../utils/clinicSchedule';
import { dashboardHeroImages } from '../utils/dashboardImages';
import { formatCurrency, formatDateTime } from '../utils/date';

export default function AdminDashboardScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: themeColors, isDark } = useTheme();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState({
    totalUsers: 0,
    patients: 0,
    doctors: 0,
    staff: 0,
    appointments: 0,
    billings: 0,
    activeAlerts: 0,
  });
  const [recentUsers, setRecentUsers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayDateKey());
  const [defaultAppointmentFee, setDefaultAppointmentFee] = useState({ amount: 2500, currency: 'LKR' });
  const [selectedFeeDoctorId, setSelectedFeeDoctorId] = useState('');
  const [doctorFee, setDoctorFee] = useState({ amount: '2500', currency: 'LKR' });
  const [savingFee, setSavingFee] = useState(false);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const [usersResponse, appointmentsResponse, billingsResponse, alertsResponse, settingsResponse] = await Promise.all([
          api.get('/users'),
          api.get('/appointments'),
          api.get('/billings'),
          api.get('/alerts'),
          api.get('/app-settings/clinic-config'),
        ]);

        const users = usersResponse.data.data || [];
        const alerts = alertsResponse.data.data || [];
        const patients = users.filter((item) => item.role === 'patient').length;
        const doctorUsers = users.filter((item) => item.role === 'doctor');
        const staff = users.filter((item) => ['finance_manager', 'pharmacist'].includes(item.role)).length;

        setOverview({
          totalUsers: users.length,
          patients,
          doctors: doctorUsers.length,
          staff,
          appointments: appointmentsResponse.data.count || 0,
          billings: billingsResponse.data.count || 0,
          activeAlerts: alerts.filter((item) => item.status === 'active').length,
        });

        setRecentUsers(users.slice(0, 5));
        setDoctors(doctorUsers);
        setAppointments(appointmentsResponse.data.data || []);
        const nextFee = settingsResponse.data.data?.appointmentFee;
        if (nextFee) {
          setDefaultAppointmentFee(nextFee);
        }

        if (doctorUsers.length && !selectedFeeDoctorId) {
          const firstDoctor = doctorUsers[0];
          const firstDoctorFee = firstDoctor.appointmentFee?.amount ? firstDoctor.appointmentFee : nextFee || defaultAppointmentFee;
          setSelectedFeeDoctorId(firstDoctor._id);
          setDoctorFee({
            amount: String(firstDoctorFee.amount || 2500),
            currency: firstDoctorFee.currency || 'LKR',
          });
        }
      } finally {
        setLoading(false);
      }
    };

    if (isFocused) {
      loadDashboard();
    }
  }, [isFocused]);

  const shortcutItems = useMemo(
    () => [
      { icon: 'people-outline', label: 'Users', onPress: () => navigation.navigate('UsersTab') },
      { icon: 'calendar-outline', label: 'Appointments', onPress: () => navigation.navigate('AppointmentsTab') },
      { icon: 'folder-open-outline', label: 'Records', onPress: () => navigation.navigate('RecordsTab') },
      { icon: 'wallet-outline', label: 'Billing', onPress: () => navigation.navigate('BillingTab') },
      { icon: 'time-outline', label: 'Clinic hours', onPress: () => navigation.navigate('ClinicSchedule') },
      { icon: 'notifications-outline', label: 'Alerts', onPress: () => navigation.navigate('AlertsTab'), badge: overview.activeAlerts || undefined },
    ],
    [navigation, overview.activeAlerts]
  );

  const selectedAppointments = useMemo(
    () => appointments.filter((appointment) => toDateKey(appointment.appointmentDate) === selectedDate),
    [appointments, selectedDate]
  );

  const handleFeeDoctorChange = (doctorId) => {
    const doctor = doctors.find((item) => item._id === doctorId);
    const nextFee = doctor?.appointmentFee?.amount ? doctor.appointmentFee : defaultAppointmentFee;

    setSelectedFeeDoctorId(doctorId);
    setDoctorFee({
      amount: String(nextFee.amount || 2500),
      currency: nextFee.currency || 'LKR',
    });
  };

  const handleSaveFee = async () => {
    const amount = Number(doctorFee.amount);
    const currency = String(doctorFee.currency || '').trim().toUpperCase();

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid fee', 'Appointment fee must be greater than 0.');
      return;
    }

    if (currency.length < 3 || currency.length > 6) {
      Alert.alert('Invalid currency', 'Please enter a valid currency code like LKR.');
      return;
    }

    if (!selectedFeeDoctorId) {
      Alert.alert('Doctor required', 'Please select a doctor before saving the fee.');
      return;
    }

    try {
      setSavingFee(true);
      const response = await api.put(`/users/${selectedFeeDoctorId}`, {
        appointmentFee: { amount, currency },
      });
      const savedFee = response.data.data?.appointmentFee || { amount, currency };
      setDoctorFee({
        amount: String(savedFee.amount),
        currency: savedFee.currency,
      });
      setDoctors((current) =>
        current.map((doctor) =>
          doctor._id === selectedFeeDoctorId
            ? { ...doctor, appointmentFee: savedFee }
            : doctor
        )
      );
      Alert.alert('Saved', 'Doctor appointment fee updated successfully.');
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Unable to update appointment fee.');
    } finally {
      setSavingFee(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="Loading admin dashboard..." />;
  }

  return (
    <ScreenContainer>
      <DashboardTopBar
        onViewProfile={() => navigation.navigate('Profile')}
        shortcutItems={shortcutItems}
        title="Smart Clinic Admin"
      />

      <ImageBackground
        imageStyle={styles.heroImage}
        source={{ uri: dashboardHeroImages.admin.uri }}
        style={styles.hero}
      >
        <View style={styles.heroOverlay}>
          <Text style={styles.title}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={styles.subtitle}>
            See users, alerts, billing, and appointments from one place without staff-only tools mixed in.
          </Text>
        </View>
      </ImageBackground>

      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>System overview</Text>
      <View style={styles.statsGrid}>
        <StatCard label="Total users" value={overview.totalUsers} />
        <StatCard label="Patients" value={overview.patients} />
        <StatCard label="Doctors" value={overview.doctors} />
        <StatCard label="Staff" value={overview.staff} />
        <StatCard label="Appointments" value={overview.appointments} />
        <StatCard label="Billings" value={overview.billings} />
        <StatCard label="Active alerts" value={overview.activeAlerts} />
      </View>

      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Doctor fees</Text>
      <View style={[styles.feeCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <View style={styles.feeSummary}>
          <View>
            <Text style={[styles.feeLabel, { color: themeColors.textMuted }]}>Selected doctor fee</Text>
            <Text style={[styles.feeValue, { color: themeColors.primaryDark }]}>
              {formatCurrency(doctorFee.amount, doctorFee.currency)}
            </Text>
          </View>
          <Text style={[styles.feeHint, { color: themeColors.textMuted }]}>
            New bookings use the selected doctor's fee. If a doctor has no fee yet, the clinic default is {formatCurrency(defaultAppointmentFee.amount, defaultAppointmentFee.currency)}.
          </Text>
        </View>
        <AppSelect
          items={doctors.map((doctor) => ({
            label: `Dr ${doctor.firstName} ${doctor.lastName}${doctor.specialization ? ` - ${doctor.specialization}` : ''}`,
            value: doctor._id,
          }))}
          label="Doctor"
          onValueChange={handleFeeDoctorChange}
          value={selectedFeeDoctorId}
        />
        <View style={styles.feeFormRow}>
          <View style={styles.feeInputWide}>
            <AppInput
              keyboardType="numeric"
              label="Amount"
              onChangeText={(amount) => setDoctorFee((current) => ({ ...current, amount }))}
              value={doctorFee.amount}
            />
          </View>
          <View style={styles.feeInputSmall}>
            <AppInput
              autoCapitalize="characters"
              label="Currency"
              onChangeText={(currency) => setDoctorFee((current) => ({ ...current, currency }))}
              value={doctorFee.currency}
            />
          </View>
        </View>
        <AppButton loading={savingFee} onPress={handleSaveFee} title="Save doctor fee" />
      </View>

      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Appointments</Text>
      <View style={[styles.appointmentPanel, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <DateTimeField
          allowPastDates
          label="Select appointment date"
          mode="date"
          onChange={setSelectedDate}
          value={selectedDate}
        />
        {selectedAppointments.length === 0 ? (
          <Text style={[styles.emptyAppointments, { color: themeColors.textMuted }]}>No appointments found for the selected date.</Text>
        ) : (
          selectedAppointments.map((appointment) => (
            <Pressable
              key={appointment._id}
              onPress={() => navigation.navigate('AppointmentsTab', {
                screen: 'AppointmentForm',
                params: { appointment },
              })}
              style={[
                styles.appointmentRow,
                {
                  backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC',
                  borderColor: themeColors.border,
                },
              ]}
            >
              <View style={styles.appointmentRowHeader}>
                <View>
                  <Text style={[styles.appointmentTitle, { color: themeColors.text }]}>Token {appointment.tokenNumber || '-'}</Text>
                  <Text style={[styles.appointmentMeta, { color: themeColors.textMuted }]}>{formatDateTime(appointment.appointmentDate)}</Text>
                </View>
                <StatusBadge value={appointment.status} />
              </View>
              <Text style={[styles.appointmentMeta, { color: themeColors.textMuted }]}>
                Patient: {appointment.patient?.firstName} {appointment.patient?.lastName}
              </Text>
              <Text style={[styles.appointmentMeta, { color: themeColors.textMuted }]}>
                Doctor: Dr {appointment.doctor?.firstName} {appointment.doctor?.lastName}
              </Text>
              <Text style={[styles.appointmentMeta, { color: themeColors.textMuted }]}>Session: {appointment.appointmentSession || 'Not set'}</Text>
              <Text style={[styles.openHint, { color: themeColors.primaryDark }]}>Tap to view appointment details</Text>
            </Pressable>
          ))
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Recent users</Text>
      <View style={[styles.listCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        {recentUsers.map((account) => (
          <Pressable
            key={account._id}
            onPress={() => navigation.navigate('UsersTab', { screen: 'UserForm', params: { userRecord: account } })}
            style={[styles.userRow, { borderBottomColor: themeColors.border }]}
          >
            <View>
              <Text style={[styles.userName, { color: themeColors.text }]}>
                {account.firstName} {account.lastName}
              </Text>
              <Text style={[styles.userMeta, { color: themeColors.textMuted }]}>{account.email}</Text>
            </View>
            <Text style={[styles.userRole, { color: themeColors.primaryDark }]}>{String(account.role).replace(/_/g, ' ')}</Text>
          </Pressable>
        ))}
      </View>
    </ScreenContainer>
  );
}

function StatCard({ label, value }) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.statCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <Text style={[styles.statValue, { color: themeColors.primaryDark }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: themeColors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    minHeight: 190,
    overflow: 'hidden',
  },
  heroImage: {
    borderRadius: radii.lg,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    backgroundColor: 'rgba(10, 34, 41, 0.52)',
  },
  title: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#E0F2FE',
    marginTop: spacing.sm,
    lineHeight: 22,
    maxWidth: '86%',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  statLabel: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  feeCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow,
  },
  feeSummary: {
    marginBottom: spacing.md,
  },
  feeLabel: {
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  feeValue: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  feeHint: {
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  feeFormRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  feeInputWide: {
    flex: 2,
  },
  feeInputSmall: {
    flex: 1,
  },
  appointmentPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow,
  },
  appointmentRow: {
    backgroundColor: '#F8FBFC',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  appointmentRowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  appointmentTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  appointmentMeta: {
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: 2,
  },
  emptyAppointments: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  openHint: {
    color: colors.primaryDark,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  userRow: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  userName: {
    color: colors.text,
    fontWeight: '700',
  },
  userMeta: {
    color: colors.textMuted,
    marginTop: 4,
  },
  userRole: {
    color: colors.primaryDark,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
