import { useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import api from '../api/client';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppSelect from '../components/AppSelect';
import ScreenContainer from '../components/ScreenContainer';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { openBillingInvoice } from '../utils/billing';
import { formatCurrency, formatDateTime } from '../utils/date';

const financePaymentMethods = [
  { label: 'Cash at clinic', value: 'cash' },
  { label: 'Card at clinic', value: 'card' },
];

export default function BillingDetailScreen({ navigation, route }) {
  const { colors: themeColors, isDark } = useTheme();
  const { user } = useAuth();
  const existingBilling = route.params?.billing || null;
  const canEdit = user?.role === 'finance_manager';
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [form, setForm] = useState({
    paymentMethod: ['cash', 'card'].includes(existingBilling?.paymentMethod) ? existingBilling.paymentMethod : 'cash',
    status: route.params?.requestedStatus || existingBilling?.status || 'pending',
    notes: existingBilling?.notes || '',
  });

  const handleSave = async () => {
    if (!existingBilling?._id) {
      Alert.alert('Billing unavailable', 'Open a payment record from the billing list first.');
      return;
    }

    if (form.status === 'paid' && !['cash', 'card'].includes(form.paymentMethod)) {
      Alert.alert('Payment method required', 'Choose cash or card before confirming an in-clinic payment.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        paymentMethod: form.paymentMethod,
        status: form.status,
        notes: form.notes,
      };

      await api.put(`/billings/${existingBilling._id}`, payload);

      Alert.alert('Saved', 'Billing record saved successfully.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Unable to save billing record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayWithPaypal = async () => {
    try {
      setPaying(true);
      const response = await api.post(`/payments/paypal/billings/${existingBilling._id}/order`);
      await Linking.openURL(response.data.data.approvalUrl);
      Alert.alert('Continue payment', 'PayPal opened in your browser. Return to the app after payment and refresh this page.');
    } catch (error) {
      Alert.alert('Payment unavailable', error?.response?.data?.message || 'Unable to start PayPal checkout.');
    } finally {
      setPaying(false);
    }
  };

  if (!existingBilling) {
    return (
      <ScreenContainer>
        <View style={[styles.detailCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.text }]}>No payment selected</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
            Open a payment record from the Payments tab to view or update it.
          </Text>
          <AppButton onPress={() => navigation.goBack()} title="Go back" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={[styles.detailCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>{canEdit ? 'Update payment' : 'Payment detail'}</Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          {canEdit
            ? 'Confirm cash or card payments received at the clinic counter.'
            : 'View appointment payment details and download the bill after payment.'}
        </Text>
        <StatusBadge value={existingBilling?.status} />
        <DetailRow label="Amount" value={formatCurrency(existingBilling?.amount, existingBilling?.currency)} />
        <DetailRow label="Patient" value={`${existingBilling?.patient?.firstName || ''} ${existingBilling?.patient?.lastName || ''}`.trim()} />
        <DetailRow label="Doctor" value={`${existingBilling?.doctor?.firstName || ''} ${existingBilling?.doctor?.lastName || ''}`.trim()} />
        <DetailRow
          label="Appointment time"
          value={existingBilling?.appointment?.appointmentDate ? formatDateTime(existingBilling.appointment.appointmentDate) : 'Not linked'}
        />
        <DetailRow label="Session" value={existingBilling?.appointment?.appointmentSession || 'Not set'} />
        <DetailRow
          label="Token number"
          value={existingBilling?.appointment?.tokenNumber ? String(existingBilling.appointment.tokenNumber) : 'Not assigned'}
        />
        <DetailRow label="Payment method" value={String(existingBilling?.paymentMethod || 'Not set').replace(/_/g, ' ')} />
        {user?.role !== 'admin' ? <DetailRow label="Notes" value={existingBilling?.notes || 'No notes added'} /> : null}

        {canEdit ? (
          <View style={styles.financeForm}>
            {existingBilling?.paymentMethod === 'paypal' ? (
              <Text
                style={[
                  styles.paypalNote,
                  {
                    backgroundColor: isDark ? '#102B45' : '#EFF6FF',
                    borderColor: isDark ? '#1D4E7A' : '#BFDBFE',
                    color: themeColors.info,
                  },
                ]}
              >
                PayPal payments are marked paid automatically after checkout.
              </Text>
            ) : (
              <>
                <AppSelect
                  items={financePaymentMethods}
                  label="Counter payment method"
                  onValueChange={(paymentMethod) => setForm((current) => ({ ...current, paymentMethod }))}
                  value={form.paymentMethod}
                />
                <View
                  style={[
                    styles.toggleCard,
                    { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC', borderColor: themeColors.border },
                  ]}
                >
                  <View style={styles.toggleCopy}>
                    <Text style={[styles.toggleLabel, { color: themeColors.text }]}>Payment status</Text>
                    <Text style={[styles.toggleHint, { color: themeColors.textMuted }]}>
                      Switch on only after the cash/card payment has been received.
                    </Text>
                  </View>
                  <View style={styles.toggleRow}>
                    <Text style={[styles.toggleState, form.status === 'paid' ? styles.paidText : styles.pendingText]}>
                      {form.status === 'paid' ? 'Paid' : 'Pending'}
                    </Text>
                    <Switch
                      onValueChange={(value) => setForm((current) => ({ ...current, status: value ? 'paid' : 'pending' }))}
                      thumbColor={colors.surface}
                      trackColor={{ false: '#FCA5A5', true: '#86EFAC' }}
                      value={form.status === 'paid'}
                    />
                  </View>
                </View>
                <AppInput
                  label="Notes"
                  multiline
                  onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
                  value={form.notes}
                />
              </>
            )}
          </View>
        ) : null}

        <View style={styles.actions}>
          {user?.role === 'patient' && existingBilling?.status !== 'paid' && existingBilling?.paymentMethod === 'paypal' ? (
            <AppButton loading={paying} onPress={handlePayWithPaypal} title="Pay with PayPal" />
          ) : null}
          {user?.role === 'patient' && existingBilling?.status !== 'paid' && existingBilling?.paymentMethod !== 'paypal' ? (
            <Text style={[styles.counterHint, { color: themeColors.textMuted }]}>
              Please pay this amount at the clinic counter by cash or card.
            </Text>
          ) : null}
          {canEdit && existingBilling?.paymentMethod !== 'paypal' ? (
            <AppButton loading={submitting} onPress={handleSave} title="Save payment status" />
          ) : null}
          {existingBilling?.status === 'paid' ? (
            <AppButton onPress={() => openBillingInvoice(existingBilling._id)} title="Download bill PDF" variant="secondary" />
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
}

function DetailRow({ label, value }) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: themeColors.border }]}>
      <Text style={[styles.rowLabel, { color: themeColors.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: themeColors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  detailCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  financeForm: {
    marginTop: spacing.lg,
  },
  paypalNote: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: radii.md,
    color: colors.info,
    fontWeight: '700',
    lineHeight: 20,
    padding: spacing.md,
  },
  counterHint: {
    color: colors.textMuted,
    fontWeight: '700',
    lineHeight: 20,
  },
  toggleCard: {
    backgroundColor: '#F8FBFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  toggleCopy: {
    gap: spacing.xs,
  },
  toggleLabel: {
    color: colors.text,
    fontWeight: '700',
  },
  toggleHint: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  toggleRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleState: {
    fontWeight: '800',
  },
  paidText: {
    color: colors.success,
  },
  pendingText: {
    color: colors.danger,
  },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  rowValue: {
    color: colors.text,
    fontWeight: '700',
  },
});
