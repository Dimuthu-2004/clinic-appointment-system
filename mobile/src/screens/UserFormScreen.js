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
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: userRecord?.firstName || '',
    lastName: userRecord?.lastName || '',
    email: userRecord?.email || '',
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

  const handleSave = async () => {
    if (!isEditing) {
      Alert.alert('Registration only', 'New accounts are created from the registration screen.');
      return;
    }

    const validationError = validateForm();

    if (validationError) {
      Alert.alert('Validation error', validationError);
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();

      if (isEditing) {
        await api.put(`/users/${userRecord._id}`, payload);
      } else {
        await api.post('/users', payload);
      }

      Alert.alert('Saved', 'Changes saved successfully.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Unable to save user.');
    } finally {
      setSubmitting(false);
    }
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
            ? 'Review and edit an existing account.'
            : 'New accounts are created from the registration screen.'}
        </Text>

        {isEditing ? (
          <>
            <AppSelect items={roleItems} label="Role" value={form.role} onValueChange={handleRoleChange} />
            <AppInput label="First name" value={form.firstName} onChangeText={(firstName) => setForm((current) => ({ ...current, firstName }))} />
            <AppInput label="Last name" value={form.lastName} onChangeText={(lastName) => setForm((current) => ({ ...current, lastName }))} />
            <AppInput
              label="Email"
              value={form.email}
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={(email) => setForm((current) => ({ ...current, email }))}
            />
            <AppInput
              label="New password (optional)"
              value={form.password}
              secureTextEntry
              onChangeText={(password) => setForm((current) => ({ ...current, password }))}
            />
            <AppInput label="Phone" value={form.phone} keyboardType="phone-pad" onChangeText={(phone) => setForm((current) => ({ ...current, phone }))} />
            <AppInput label="Address" value={form.address} multiline onChangeText={(address) => setForm((current) => ({ ...current, address }))} />

            {showNic ? (
              <AppInput
                label="NIC"
                value={form.nic}
                autoCapitalize="characters"
                onChangeText={(nic) => setForm((current) => ({ ...current, nic }))}
              />
            ) : null}

            {isDoctor ? (
              <>
                <AppInput
                  label="Specialization"
                  value={form.specialization}
                  onChangeText={(specialization) => setForm((current) => ({ ...current, specialization }))}
                />
                <AppInput
                  label="SLMC registration number"
                  value={form.slmcRegistrationNumber}
                  autoCapitalize="characters"
                  onChangeText={(slmcRegistrationNumber) => setForm((current) => ({ ...current, slmcRegistrationNumber }))}
                />
              </>
            ) : null}

            <View style={styles.actions}>
              <AppButton title="Save changes" loading={submitting} onPress={handleSave} />
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
});
