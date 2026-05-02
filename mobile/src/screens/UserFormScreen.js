import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppSelect from '../components/AppSelect';
import ScreenContainer from '../components/ScreenContainer';
import { colors, radii, spacing, useTheme } from '../theme';
import { isValidEmail, isValidSriLankanNic, isValidSriLankanPhone } from '../utils/validation';
import api from '../api/client';

const roleItems = [
  { label: 'Patient', value: 'patient' },
  { label: 'Doctor', value: 'doctor' },
  { label: 'Finance Manager', value: 'finance_manager' },
  { label: 'Pharmacist', value: 'pharmacist' },
  { label: 'Admin', value: 'admin' },
];

export default function UserFormScreen({ navigation, route }) {
  const { colors: themeColors } = useTheme();
  const userRecord = route.params?.userRecord || null;
  const isEditing = Boolean(userRecord?._id);
  const [form, setForm] = useState({
    firstName: userRecord?.firstName || '',
    lastName: userRecord?.lastName || '',
    email: userRecord?.email || '',
    recoveryEmail: userRecord?.recoveryEmail || '',
    password: '',
    role: userRecord?.role || 'patient',
    phone: userRecord?.phone || '',
    address: userRecord?.address || '',
    specialization: userRecord?.specialization || '',
    nic: userRecord?.nic || '',
    slmcRegistrationNumber: userRecord?.slmcRegistrationNumber || '',
  });

  const isDoctor = form.role === 'doctor';
  const isStaff = ['finance_manager', 'pharmacist'].includes(form.role);
  const showNic = isDoctor || isStaff;

  const handleRoleChange = (role) => {
    setForm((current) => ({
      ...current,
      role,
      specialization: role === 'doctor' ? current.specialization : '',
      slmcRegistrationNumber: role === 'doctor' ? current.slmcRegistrationNumber : '',
      nic: ['doctor', 'finance_manager', 'pharmacist'].includes(role) ? current.nic : '',
    }));
  };

  const validateForm = () => {
    if (!form.firstName || !form.lastName || !form.email || !form.phone) {
      return 'Please complete the required fields.';
    }

    if (!isValidEmail(form.email)) {
      return 'Please enter a valid email address.';
    }

    if (!isValidSriLankanPhone(form.phone)) {
      return 'Phone number must match a valid Sri Lankan format.';
    }

    if (!isEditing && form.password.length < 6) {
      return 'New users need a password with at least 6 characters.';
    }

    if (form.password && form.password.length < 6) {
      return 'Password must be at least 6 characters long.';
    }

    if (isDoctor) {
      if (!form.specialization || !form.nic || !form.slmcRegistrationNumber) {
        return 'Doctor accounts require specialization, NIC, and SLMC registration number.';
      }
      if (!isValidSriLankanNic(form.nic)) {
        return 'Doctor NIC must match the Sri Lankan old or new NIC format.';
      }
    }

    if (isStaff && form.nic && !isValidSriLankanNic(form.nic)) {
      return 'Staff NIC must match the Sri Lankan old or new NIC format.';
    }

    if (form.role === 'admin' && form.nic && !isValidSriLankanNic(form.nic)) {
      return 'Admin NIC must match the Sri Lankan old or new NIC format.';
    }

    return '';
  };

  const buildPayload = () => {
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role,
      phone: form.phone.trim(),
      address: form.address.trim(),
      specialization: isDoctor ? form.specialization.trim() : '',
      nic: showNic && form.nic ? form.nic.trim().toUpperCase() : '',
      slmcRegistrationNumber: isDoctor ? form.slmcRegistrationNumber.trim().toUpperCase() : '',
    };

    if (form.password) {
      payload.password = form.password;
    }

    return payload;
  };

  const handleDelete = async () => {
    const displayName = `${userRecord?.firstName || ''} ${userRecord?.lastName || ''}`.trim() || 'this user';

    Alert.alert(
      `Delete ${displayName}?`,
      'This will permanently remove the account. Existing appointments, bills, reviews, and records linked to this user may remain for audit history, but the user will no longer be able to log in.',
      [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete permanently',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/users/${userRecord._id}`);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Delete failed', error?.response?.data?.message || 'Unable to delete user.');
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>{isEditing ? 'User details' : 'Registration only'}</Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          {isEditing
            ? 'Review this account and remove it if needed.'
            : 'New accounts are created from the registration screen.'}
        </Text>

        {isEditing ? (
          <>
            <View style={[styles.detailsCard, { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.border }]}>
              <DetailRow label="Role" value={roleItems.find((item) => item.value === form.role)?.label || form.role} />
              <DetailRow label="First name" value={form.firstName || 'Not set'} />
              <DetailRow label="Last name" value={form.lastName || 'Not set'} />
              <DetailRow label="Email" value={form.email || 'Not set'} />
              <DetailRow label="Recovery email" value={form.recoveryEmail || 'Not set'} />
              <DetailRow label="Phone" value={form.phone || 'Not set'} />
              <DetailRow label="Address" value={form.address || 'Not set'} />
              {showNic ? <DetailRow label="NIC" value={form.nic || 'Not set'} /> : null}
              {isDoctor ? <DetailRow label="Specialization" value={form.specialization || 'Not set'} /> : null}
              {isDoctor ? (
                <DetailRow
                  label="SLMC registration number"
                  value={form.slmcRegistrationNumber || 'Not set'}
                />
              ) : null}
            </View>

            <View style={styles.actions}>
              <AppButton title="Delete user" variant="danger" onPress={handleDelete} />
            </View>
          </>
        ) : (
          <View style={styles.actions}>
            <AppButton title="Back" onPress={() => navigation.goBack()} />
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
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
  },
  detailsCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
});

function DetailRow({ label, value }) {
  const { colors: themeColors } = useTheme();

  return (
    <View>
      <Text style={{ color: themeColors.textMuted, fontWeight: '700', marginBottom: 2 }}>{label}</Text>
      <Text style={{ color: themeColors.text, lineHeight: 21 }}>{value}</Text>
    </View>
  );
}
