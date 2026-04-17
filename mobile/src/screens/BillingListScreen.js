import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import AppButton from '../components/AppButton';
import EmptyState from '../components/EmptyState';
import EntityCard from '../components/EntityCard';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { openBillingInvoice } from '../utils/billing';
import { formatCurrency, formatDateOnly, formatDateTime } from '../utils/date';

export default function BillingListScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: themeColors, isDark } = useTheme();
  const isFocused = useIsFocused();
  const [billings, setBillings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingBillingId, setPayingBillingId] = useState('');

  useEffect(() => {
    const loadBillings = async () => {
      try {
        setLoading(true);
        const response = await api.get('/billings');
        setBillings(response.data.data);
      } catch (error) {
        Alert.alert('Unable to load billing', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (isFocused) {
      loadBillings();
    }
  }, [isFocused]);

  const handlePayWithPaypal = async (billingId) => {
    try {
      setPayingBillingId(billingId);
      const response = await api.post(`/payments/paypal/billings/${billingId}/order`);
      await Linking.openURL(response.data.data.approvalUrl);
      Alert.alert('Continue payment', 'PayPal opened in your browser. Return to the app after payment and refresh Payments.');
    } catch (error) {
      Alert.alert('Payment unavailable', error?.response?.data?.message || 'Unable to start PayPal checkout.');
    } finally {
      setPayingBillingId('');
    }
  };

  const openFinanceStatusUpdate = (billing, nextPaidValue) => {
    navigation.navigate('BillingDetail', {
      billing,
      requestedStatus: nextPaidValue ? 'paid' : 'pending',
    });
  };

  if (loading) {
    return <LoadingOverlay message={user?.role === 'patient' ? 'Loading payments...' : 'Loading billing records...'} />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: themeColors.text }]}>{user?.role === 'patient' ? 'Payments' : 'Billing Records'}</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
            {user?.role === 'patient'
              ? 'Review appointment payments, pay online when PayPal is selected, or pay at the clinic counter.'
              : 'Track charges, payment status, and linked appointment invoices.'}
          </Text>
        </View>
      </View>

      {billings.length === 0 ? (
        <EmptyState
          message={
            user?.role === 'patient'
              ? 'No payments are linked to your appointments yet.'
              : 'No billing entries exist yet.'
          }
          title={user?.role === 'patient' ? 'No payments yet' : 'No billing data'}
        />
      ) : (
        billings.map((billing) =>
          user?.role === 'patient' ? (
            <View key={billing._id} style={[styles.paymentCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <View style={styles.paymentHeader}>
                <Text style={[styles.paymentTitle, { color: themeColors.text }]}>Appointment payment</Text>
                <StatusBadge value={billing.status} />
              </View>
              <Text style={[styles.paymentMeta, { color: themeColors.textMuted }]}>
                Doctor: {billing.doctor?.firstName} {billing.doctor?.lastName}
              </Text>
              <Text style={[styles.paymentMeta, { color: themeColors.textMuted }]}>
                Appointment: {billing.appointment?.appointmentDate ? formatDateTime(billing.appointment.appointmentDate) : 'Not linked'}
              </Text>
              <Text style={[styles.paymentMeta, { color: themeColors.textMuted }]}>
                Session: {billing.appointment?.appointmentSession || 'Not set'}
              </Text>
              <Text style={[styles.paymentMeta, { color: themeColors.textMuted }]}>
                Token: {billing.appointment?.tokenNumber || 'Not assigned'}
              </Text>
              <Text style={[styles.paymentMeta, { color: themeColors.textMuted }]}>Method: {String(billing.paymentMethod || 'Not set').replace(/_/g, ' ')}</Text>
              <Text style={[styles.paymentAmount, { color: themeColors.primaryDark }]}>{formatCurrency(billing.amount, billing.currency)}</Text>
              <View style={styles.paymentActions}>
                {billing.status !== 'paid' && billing.paymentMethod === 'paypal' ? (
                  <AppButton
                    loading={payingBillingId === billing._id}
                    onPress={() => handlePayWithPaypal(billing._id)}
                    title="Pay with PayPal"
                  />
                ) : null}
                {billing.status !== 'paid' && billing.paymentMethod !== 'paypal' ? (
                  <Text style={[styles.counterPaymentHint, { color: themeColors.textMuted }]}>Please complete this payment at the clinic counter.</Text>
                ) : null}
                <AppButton
                  onPress={() => navigation.navigate('BillingDetail', { billing })}
                  title="View details"
                  variant="secondary"
                />
                {billing.status === 'paid' ? (
                  <AppButton
                    onPress={() => openBillingInvoice(billing._id)}
                    title="Download bill PDF"
                    variant="outline"
                  />
                ) : null}
              </View>
            </View>
          ) : (
            <EntityCard
              key={billing._id}
              meta={[
                `Amount: ${formatCurrency(billing.amount, billing.currency)}`,
                `Patient: ${billing.patient?.firstName} ${billing.patient?.lastName}`,
                `Method: ${String(billing.paymentMethod || 'Not set').replace(/_/g, ' ')}`,
                `Appointment: ${billing.appointment?.appointmentDate ? formatDateOnly(billing.appointment.appointmentDate) : 'Not linked'}`,
              ]}
              onPress={() => navigation.navigate('BillingDetail', { billing })}
              status={billing.status}
              subtitle={`Doctor: ${billing.doctor?.firstName} ${billing.doctor?.lastName}`}
              title={billing.appointment?.reason || 'Clinic billing record'}
              footer={
                <View style={styles.billingFooter}>
                  {user?.role === 'finance_manager' ? (
                    <View style={[styles.statusToggleRow, { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC', borderColor: themeColors.border }]}>
                      <View style={styles.statusToggleCopy}>
                        <Text style={[styles.statusToggleLabel, { color: themeColors.text }]}>Payment status</Text>
                        <Text style={[styles.statusToggleHint, { color: themeColors.textMuted }]}>
                          {billing.paymentMethod === 'paypal'
                            ? 'PayPal updates automatically after checkout.'
                            : 'Tap the switch to confirm a cash/card payment.'}
                        </Text>
                      </View>
                      <Switch
                        disabled={billing.paymentMethod === 'paypal'}
                        onValueChange={(value) => openFinanceStatusUpdate(billing, value)}
                        thumbColor={colors.surface}
                        trackColor={{ false: '#FCA5A5', true: '#86EFAC' }}
                        value={billing.status === 'paid'}
                      />
                    </View>
                  ) : null}
                  {billing.status === 'paid' ? (
                    <AppButton
                      onPress={() => openBillingInvoice(billing._id)}
                      title="Download bill PDF"
                      variant="secondary"
                    />
                  ) : null}
                </View>
              }
            />
          )
        )
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
  paymentCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  paymentTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  paymentMeta: {
    color: colors.textMuted,
    lineHeight: 21,
    marginTop: 2,
  },
  paymentAmount: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  paymentActions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  counterPaymentHint: {
    color: colors.textMuted,
    lineHeight: 20,
    fontWeight: '700',
  },
  billingFooter: {
    gap: spacing.md,
  },
  statusToggleRow: {
    backgroundColor: '#F8FBFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  statusToggleCopy: {
    flex: 1,
  },
  statusToggleLabel: {
    color: colors.text,
    fontWeight: '800',
  },
  statusToggleHint: {
    color: colors.textMuted,
    marginTop: 3,
    lineHeight: 18,
  },
});
