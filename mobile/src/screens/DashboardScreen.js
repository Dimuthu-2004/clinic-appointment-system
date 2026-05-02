import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import DashboardTopBar from '../components/DashboardTopBar';
import DoctorAvailabilityCard from '../components/DoctorAvailabilityCard';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, shadow, spacing, useTheme } from '../theme';
import { dashboardHeroImages } from '../utils/dashboardImages';
import { formatCurrency } from '../utils/date';

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const [stats, setStats] = useState({});
  const [financeBillings, setFinanceBillings] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [patientAlerts, setPatientAlerts] = useState([]);
  const displayName = `${user?.role === 'doctor' ? 'Dr ' : ''}${user?.firstName || ''} ${user?.lastName || ''}`.trim();

  const roleConfig = useMemo(() => {
    const configByRole = {
      patient: {
        intro: 'Appointments, records, prescriptions, payments, and updates in one place.',
        stats: [
          { label: 'Appointments', key: 'appointments', endpoint: '/appointments' },
          { label: 'Payments', key: 'billings', endpoint: '/billings' },
          { label: 'Alerts', key: 'alerts', endpoint: '/alerts' },
          { label: 'Prescriptions', key: 'prescriptions', endpoint: '/prescriptions' },
        ],
        shortcuts: [
          { icon: 'calendar-outline', label: 'Appointments', onPress: () => navigation.navigate('AppointmentsTab') },
          {
            icon: 'add-circle-outline',
            label: 'Book appointment',
            onPress: () =>
              navigation.navigate('AppointmentsTab', {
                screen: 'AppointmentForm',
              }),
          },
          { icon: 'folder-open-outline', label: 'Medical records', onPress: () => navigation.navigate('RecordsTab') },
          { icon: 'document-attach-outline', label: 'Prescriptions', onPress: () => navigation.navigate('PrescriptionTab') },
          { icon: 'card-outline', label: 'Payments', onPress: () => navigation.navigate('BillingTab') },
          { icon: 'chatbubble-ellipses-outline', label: 'Feedback', onPress: () => navigation.navigate('ReviewList') },
          { icon: 'notifications-outline', label: 'Alerts', onPress: () => navigation.navigate('AlertsTab') },
        ],
      },
      doctor: {
        intro: 'Appointments, medical history, prescriptions, and patient feedback in one place.',
        stats: [
          { label: 'Appointments', key: 'appointments', endpoint: '/appointments' },
          { label: 'Records', key: 'records', endpoint: '/medical-records' },
          { label: 'Prescriptions', key: 'prescriptions', endpoint: '/prescriptions' },
          { label: 'Feedback', key: 'reviews', endpoint: '/reviews' },
        ],
        shortcuts: [
          { icon: 'calendar-outline', label: 'Appointments', onPress: () => navigation.navigate('AppointmentsTab') },
          { icon: 'time-outline', label: 'Medical history', onPress: () => navigation.navigate('RecordsTab') },
          { icon: 'document-attach-outline', label: 'Prescriptions', onPress: () => navigation.navigate('PrescriptionTab') },
          { icon: 'chatbubble-ellipses-outline', label: 'Feedback', onPress: () => navigation.navigate('ReviewList') },
          { icon: 'notifications-outline', label: 'Alerts', onPress: () => navigation.navigate('AlertsTab') },
        ],
      },
      finance_manager: {
        intro: 'Billing and payment follow-up for clinic appointments.',
        stats: [{ label: 'Billings', key: 'billings', endpoint: '/billings' }],
        shortcuts: [{ icon: 'wallet-outline', label: 'Payment details', onPress: () => navigation.navigate('BillingTab') }],
      },
      pharmacist: {
        intro: 'Manage pharmacy stock, prices, photos, and availability.',
        stats: [{ label: 'Inventory items', key: 'drugs', endpoint: '/drugs' }],
        shortcuts: [{ icon: 'medkit-outline', label: 'Drug inventory', onPress: () => navigation.navigate('DrugTab') }],
      },
    };

    return configByRole[user?.role] || configByRole.patient;
  }, [navigation, user?.role]);

  useEffect(() => {
    const loadStats = async () => {
      const requests = [
        ...roleConfig.stats.map((item) => api.get(item.endpoint)),
        ...(user?.role === 'patient' ? [api.get('/notifications/unread-count')] : []),
      ];
      const responses = await Promise.allSettled(requests);

      const nextStats = {};

      roleConfig.stats.forEach((stat, index) => {
        const response = responses[index];
        nextStats[stat.key] =
          response.status === 'fulfilled'
            ? response.value.data.count ??
              (Array.isArray(response.value.data.data) ? response.value.data.data.length : 0)
            : 0;
      });

      setStats(nextStats);

      if (user?.role === 'finance_manager') {
        const billingResponse = responses.find(
          (response, index) => roleConfig.stats[index]?.key === 'billings' && response.status === 'fulfilled'
        );
        setFinanceBillings(billingResponse?.value?.data?.data || []);
      }

      if (user?.role === 'patient') {
        const notificationResponse = responses[roleConfig.stats.length];
        setUnreadNotifications(
          notificationResponse?.status === 'fulfilled'
            ? notificationResponse.value.data.data?.unreadCount || 0
            : 0
        );
        const alertsResponse = responses.find(
          (response, index) => roleConfig.stats[index]?.key === 'alerts' && response.status === 'fulfilled'
        );
        setPatientAlerts((alertsResponse?.value?.data?.data || []).filter((item) => item.status === 'active').slice(0, 3));
      }
    };

    if (isFocused) {
      loadStats();
    }
  }, [isFocused, roleConfig, user?.role]);

  return (
    <ScreenContainer>
      <DashboardTopBar
        notificationCount={unreadNotifications}
        onOpenNotifications={() => navigation.navigate('NotificationList')}
        onViewProfile={() => navigation.navigate('Profile')}
        shortcutItems={roleConfig.shortcuts}
        showNotifications={user?.role === 'patient'}
        title={
          user?.role === 'doctor'
            ? 'Doctor dashboard'
            : user?.role === 'finance_manager'
              ? 'Finance dashboard'
              : user?.role === 'pharmacist'
                ? 'Pharmacy dashboard'
                : 'Patient dashboard'
        }
      />

      {user?.role === 'patient' && patientAlerts.length ? (
        <View style={styles.alertStripSection}>
          <View style={styles.alertStripHeader}>
            <Text style={[styles.alertStripTitle, { color: colors.text }]}>Clinic alerts</Text>
            <Pressable onPress={() => navigation.navigate('AlertsTab')}>
              <Text style={styles.alertStripLink}>View all</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.alertStripRow}>
              {patientAlerts.map((alertItem) => (
                <Pressable
                  key={alertItem._id}
                  onPress={() => navigation.navigate('AlertsTab')}
                  style={styles.alertStripCard}
                >
                  <Text style={styles.alertStripCardTitle}>{alertItem.title}</Text>
                  <Text numberOfLines={3} style={styles.alertStripCardBody}>
                    {alertItem.message}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <ImageBackground
        imageStyle={styles.heroImage}
        source={{ uri: dashboardHeroImages[user?.role]?.uri || dashboardHeroImages.patient.uri }}
        style={styles.hero}
      >
        <View style={styles.heroOverlay}>
          <Text style={styles.heroGreeting}>Welcome back</Text>
          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroText}>{roleConfig.intro}</Text>
        </View>
      </ImageBackground>

      {user?.role === 'doctor' ? <DoctorAvailabilityCard active={isFocused} /> : null}
      {user?.role === 'finance_manager' ? <FinanceOverview billings={financeBillings} /> : null}

      <View style={styles.statsGrid}>
        {roleConfig.stats.map((stat) => (
          <StatCard key={stat.key} label={stat.label} value={stats[stat.key] || 0} />
        ))}
      </View>
    </ScreenContainer>
  );
}

function CountUpText({ value, currency = '', style }) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    animatedValue.setValue(0);
    const listener = animatedValue.addListener(({ value: nextValue }) => {
      setDisplayValue(nextValue);
    });

    Animated.timing(animatedValue, {
      toValue: Number(value) || 0,
      duration: 900,
      useNativeDriver: false,
    }).start();

    return () => {
      animatedValue.removeListener(listener);
    };
  }, [animatedValue, value]);

  return (
    <Text style={style}>
      {currency ? formatCurrency(displayValue, currency) : Math.round(displayValue)}
    </Text>
  );
}

function FinanceOverview({ billings }) {
  const { colors: themeColors } = useTheme();
  const metrics = useMemo(() => {
    const paidBillings = billings.filter((billing) => billing.status === 'paid');
    const pendingBillings = billings.filter((billing) => billing.status === 'pending');
    const cancelledBillings = billings.filter((billing) => ['cancelled', 'refunded'].includes(billing.status));
    const now = Date.now();

    return {
      paidTotal: paidBillings.reduce((total, billing) => total + Number(billing.amount || 0), 0),
      pendingTotal: pendingBillings.reduce((total, billing) => total + Number(billing.amount || 0), 0),
      paidCount: paidBillings.length,
      pendingCount: pendingBillings.length,
      overdueCount: pendingBillings.filter((billing) => billing.dueDate && new Date(billing.dueDate).getTime() < now).length,
      paypalTotal: paidBillings
        .filter((billing) => billing.paymentMethod === 'paypal')
        .reduce((total, billing) => total + Number(billing.amount || 0), 0),
      cancelledCount: cancelledBillings.length,
    };
  }, [billings]);

  return (
    <View style={[styles.financePanel, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <View style={styles.financeHeader}>
        <Text style={[styles.financeTitle, { color: themeColors.text }]}>Finance overview</Text>
        <Text style={[styles.financeSubtitle, { color: themeColors.textMuted }]}>Live billing totals from paid and pending appointment payments.</Text>
      </View>
      <View style={styles.financeGrid}>
        <FinanceMetric label="Paid revenue" value={metrics.paidTotal} currency="LKR" tone="success" />
        <FinanceMetric label="Pending amount" value={metrics.pendingTotal} currency="LKR" tone="warning" />
        <FinanceMetric label="Paid bills" value={metrics.paidCount} />
        <FinanceMetric label="Pending bills" value={metrics.pendingCount} tone="warning" />
        <FinanceMetric label="Overdue" value={metrics.overdueCount} tone="danger" />
        <FinanceMetric label="PayPal paid" value={metrics.paypalTotal} currency="LKR" />
      </View>
      {metrics.cancelledCount ? (
        <Text style={[styles.financeFootnote, { color: themeColors.textMuted }]}>{metrics.cancelledCount} cancelled or refunded billing record(s) are excluded from totals.</Text>
      ) : null}
    </View>
  );
}

function FinanceMetric({ label, value, currency = '', tone = 'default' }) {
  const { colors: themeColors } = useTheme();
  const toneStyle = {
    success: styles.financeValueSuccess,
    warning: styles.financeValueWarning,
    danger: styles.financeValueDanger,
    default: styles.financeValueDefault,
  }[tone];

  return (
    <View style={[styles.financeMetricCard, { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.border }]}>
      <CountUpText currency={currency} style={[styles.financeValue, toneStyle]} value={value} />
      <Text style={[styles.financeLabel, { color: themeColors.textMuted }]}>{label}</Text>
    </View>
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
    minHeight: 210,
    overflow: 'hidden',
  },
  heroImage: {
    borderRadius: radii.lg,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    backgroundColor: 'rgba(10, 34, 41, 0.42)',
  },
  heroGreeting: {
    color: '#D7F1F8',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  heroName: {
    color: colors.surface,
    fontSize: 28,
    fontWeight: '800',
  },
  heroText: {
    color: '#F0F9FF',
    marginTop: spacing.sm,
    lineHeight: 22,
    maxWidth: '80%',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  alertStripSection: {
    marginBottom: spacing.lg,
  },
  alertStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  alertStripTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  alertStripLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  alertStripRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  alertStripCard: {
    width: 270,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    ...shadow,
  },
  alertStripCardTitle: {
    color: '#9A3412',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  alertStripCardBody: {
    color: '#7C2D12',
    lineHeight: 20,
  },
  financePanel: {
    backgroundColor: '#F8FCFB',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow,
  },
  financeHeader: {
    marginBottom: spacing.md,
  },
  financeTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  financeSubtitle: {
    color: colors.textMuted,
    lineHeight: 21,
  },
  financeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  financeMetricCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  financeValue: {
    fontSize: 21,
    fontWeight: '900',
  },
  financeValueDefault: {
    color: colors.primaryDark,
  },
  financeValueSuccess: {
    color: colors.success,
  },
  financeValueWarning: {
    color: colors.accent,
  },
  financeValueDanger: {
    color: colors.danger,
  },
  financeLabel: {
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  financeFootnote: {
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 20,
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
});
