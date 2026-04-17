import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppSelect from '../components/AppSelect';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { genders } from '../utils/constants';

export default function ProfileScreen() {
  const { user, updateProfile, signOut } = useAuth();
  const { colors: themeColors } = useTheme();
  const isDoctor = user?.role === 'doctor';
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    gender: user?.gender || 'prefer_not_to_say',
    specialization: user?.specialization || '',
    nic: user?.nic || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    try {
      setSubmitting(true);
      await updateProfile(form);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (error) {
      Alert.alert('Update failed', error?.response?.data?.message || 'Unable to update your profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.profileCard}>
        <Text style={styles.name}>
          {isDoctor ? 'Dr ' : ''}
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.meta}>{user?.email}</Text>
      </View>

      <View style={[styles.formCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Edit profile</Text>
        <AppInput
          label="First name"
          onChangeText={(firstName) => setForm((current) => ({ ...current, firstName }))}
          value={form.firstName}
        />
        <AppInput
          label="Last name"
          onChangeText={(lastName) => setForm((current) => ({ ...current, lastName }))}
          value={form.lastName}
        />
        <AppInput
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={(email) => setForm((current) => ({ ...current, email }))}
          value={form.email}
        />
        <AppInput
          keyboardType="phone-pad"
          label="Phone"
          onChangeText={(phone) => setForm((current) => ({ ...current, phone }))}
          value={form.phone}
        />
        {!isDoctor ? (
          <>
            <AppInput
              label="Address"
              multiline
              onChangeText={(address) => setForm((current) => ({ ...current, address }))}
              value={form.address}
            />
            <AppSelect
              items={genders.map((gender) => ({ label: gender.replace(/_/g, ' '), value: gender }))}
              label="Gender"
              onValueChange={(gender) => setForm((current) => ({ ...current, gender }))}
              value={form.gender}
            />
          </>
        ) : null}
        {isDoctor ? (
          <>
            <AppInput
              autoCapitalize="characters"
              label="NIC"
              onChangeText={(nic) => setForm((current) => ({ ...current, nic }))}
              value={form.nic}
            />
            <AppInput
              label="Specialization"
              onChangeText={(specialization) => setForm((current) => ({ ...current, specialization }))}
              value={form.specialization}
            />
          </>
        ) : null}

        <AppButton loading={submitting} onPress={handleSave} title="Save profile" />
      </View>

      <AppButton onPress={signOut} title="Logout" variant="danger" />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: colors.primaryDark,
    padding: spacing.lg,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
  },
  name: {
    color: colors.surface,
    fontSize: 26,
    fontWeight: '800',
  },
  meta: {
    color: '#CFFAFE',
    marginTop: spacing.xs,
  },
  formCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.md,
  },
});
