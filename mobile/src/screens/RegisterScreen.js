import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppSelect from '../components/AppSelect';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { genders, specializations, staffRoles } from '../utils/constants';
import {
  getPasswordStrength,
  isStrongPassword,
  isValidEmail,
  isValidSriLankanNic,
  isValidSriLankanPhone,
  passwordRequirementsMessage,
} from '../utils/validation';

const registrationContent = {
  patient: {
    title: 'Patient registration',
    subtitle: 'Register a patient account.',
  },
  doctor: {
    title: 'Doctor registration',
    subtitle: 'Register a doctor account.',
  },
  staff: {
    title: 'Staff registration',
    subtitle: 'Register a finance manager or pharmacist account.',
  },
};

export default function RegisterScreen({ navigation, route }) {
  const { colors: themeColors, isDark } = useTheme();
  const registrationType = route.params?.registrationType || 'patient';
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    gender: 'prefer_not_to_say',
    specialization: '',
    slmcRegistrationNumber: '',
    nic: '',
    role: 'finance_manager',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const specializationOptions = useMemo(
    () => specializations.map((item) => ({ label: item, value: item })),
    []
  );

  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const confirmPasswordMismatch = form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  const strengthColor = useMemo(() => {
    if (!passwordStrength.hasValue) {
      return themeColors.textMuted;
    }

    if (passwordStrength.score >= 5) {
      return themeColors.success;
    }

    if (passwordStrength.score === 4) {
      return themeColors.primary;
    }

    if (passwordStrength.score === 3) {
      return themeColors.accent;
    }

    return themeColors.danger;
  }, [passwordStrength, themeColors]);

  const validateForm = () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password || !form.phone) {
      return 'Please complete all required fields.';
    }

    if (!isValidEmail(form.email)) {
      return 'Please enter a valid email address.';
    }

    if (!isStrongPassword(form.password)) {
      return passwordRequirementsMessage;
    }

    if (!form.confirmPassword) {
      return 'Please confirm your password.';
    }

    if (form.password !== form.confirmPassword) {
      return 'Passwords do not match.';
    }

    if (!isValidSriLankanPhone(form.phone)) {
      return 'Phone number must match a valid Sri Lankan format.';
    }

    if (registrationType === 'doctor') {
      if (!form.specialization || !form.nic) {
        return 'Doctor registration requires specialization and NIC.';
      }

      if (!isValidSriLankanNic(form.nic)) {
        return 'Doctor NIC must match the Sri Lankan old or new NIC format.';
      }
    }

    if (registrationType === 'staff') {
      if (!form.role || !form.nic) {
        return 'Staff registration requires staff role and NIC.';
      }

      if (!isValidSriLankanNic(form.nic)) {
        return 'Staff NIC must match the Sri Lankan old or new NIC format.';
      }
    }

    return '';
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim(),
      };

      if (registrationType !== 'doctor') {
        payload.address = form.address.trim();
        payload.gender = form.gender;
      }

      if (registrationType === 'doctor') {
        payload.specialization = form.specialization.trim();
        payload.nic = form.nic.trim().toUpperCase();
      }

      if (registrationType === 'staff') {
        payload.role = form.role;
        payload.nic = form.nic.trim().toUpperCase();
      }

      await signUp(registrationType, payload);
    } catch (submitError) {
      setError(submitError?.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.heading, { color: themeColors.text }]}>
          {registrationContent[registrationType].title}
        </Text>
        <Text style={[styles.subheading, { color: themeColors.textMuted }]}>
          {registrationContent[registrationType].subtitle}
        </Text>

        <AppInput
          label="First name"
          onChangeText={(firstName) => setForm((current) => ({ ...current, firstName }))}
          placeholder="Nadeesha"
          value={form.firstName}
        />
        <AppInput
          label="Last name"
          onChangeText={(lastName) => setForm((current) => ({ ...current, lastName }))}
          placeholder="Perera"
          value={form.lastName}
        />
        <AppInput
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={(email) => setForm((current) => ({ ...current, email }))}
          placeholder="user@example.com"
          value={form.email}
        />
        <AppInput
          label="Password"
          onChangeText={(password) => setForm((current) => ({ ...current, password }))}
          placeholder="Use a strong password"
          secureTextEntry
          value={form.password}
        />
        <View
          style={[
            styles.passwordCard,
            { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC', borderColor: themeColors.border },
          ]}
        >
          <View style={styles.passwordStrengthRow}>
            <Text style={[styles.passwordStrengthLabel, { color: themeColors.text }]}>Password strength</Text>
            <Text style={[styles.passwordStrengthValue, { color: strengthColor }]}>{passwordStrength.label}</Text>
          </View>
          <View style={styles.passwordMeter}>
            {[1, 2, 3, 4, 5].map((segment) => (
              <View
                key={segment}
                style={[
                  styles.passwordMeterSegment,
                  { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                  segment <= passwordStrength.score && { backgroundColor: strengthColor, borderColor: strengthColor },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.passwordHelp, { color: themeColors.textMuted }]}>{passwordRequirementsMessage}</Text>
          <View style={styles.passwordChecklist}>
            <Text
              style={[
                styles.passwordCheckItem,
                { color: themeColors.textMuted },
                passwordStrength.checks.length && { color: themeColors.success, fontWeight: '700' },
              ]}
            >
              [{passwordStrength.checks.length ? 'x' : ' '}] At least 8 characters
            </Text>
            <Text
              style={[
                styles.passwordCheckItem,
                { color: themeColors.textMuted },
                passwordStrength.checks.uppercase && { color: themeColors.success, fontWeight: '700' },
              ]}
            >
              [{passwordStrength.checks.uppercase ? 'x' : ' '}] One uppercase letter
            </Text>
            <Text
              style={[
                styles.passwordCheckItem,
                { color: themeColors.textMuted },
                passwordStrength.checks.lowercase && { color: themeColors.success, fontWeight: '700' },
              ]}
            >
              [{passwordStrength.checks.lowercase ? 'x' : ' '}] One lowercase letter
            </Text>
            <Text
              style={[
                styles.passwordCheckItem,
                { color: themeColors.textMuted },
                passwordStrength.checks.number && { color: themeColors.success, fontWeight: '700' },
              ]}
            >
              [{passwordStrength.checks.number ? 'x' : ' '}] One number
            </Text>
            <Text
              style={[
                styles.passwordCheckItem,
                { color: themeColors.textMuted },
                passwordStrength.checks.special && { color: themeColors.success, fontWeight: '700' },
              ]}
            >
              [{passwordStrength.checks.special ? 'x' : ' '}] One special character
            </Text>
          </View>
        </View>
        <AppInput
          error={confirmPasswordMismatch ? 'Passwords do not match.' : ''}
          label="Confirm password"
          onChangeText={(confirmPassword) => setForm((current) => ({ ...current, confirmPassword }))}
          placeholder="Enter the password again"
          secureTextEntry
          value={form.confirmPassword}
        />
        <AppInput
          keyboardType="phone-pad"
          label="Phone"
          onChangeText={(phone) => setForm((current) => ({ ...current, phone }))}
          placeholder="0712345678 or +94712345678"
          value={form.phone}
        />
        {registrationType === 'staff' ? (
          <View
            style={[
              styles.roleCard,
              { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC', borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.roleLabel, { color: themeColors.text }]}>Staff role</Text>
            <Text style={[styles.roleHelp, { color: themeColors.textMuted }]}>
              Choose the correct dashboard access for this staff account.
            </Text>
            <View style={styles.roleOptions}>
              {staffRoles.map((roleItem) => {
                const selected = form.role === roleItem.value;

                return (
                  <Pressable
                    key={roleItem.value}
                    onPress={() => setForm((current) => ({ ...current, role: roleItem.value }))}
                    style={[
                      styles.roleOption,
                      { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                      selected && {
                        backgroundColor: isDark ? '#123C47' : '#ECFEFF',
                        borderColor: themeColors.primary,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: themeColors.border },
                        selected && { borderColor: themeColors.primaryDark },
                      ]}
                    >
                      {selected ? <View style={[styles.radioInner, { backgroundColor: themeColors.primaryDark }]} /> : null}
                    </View>
                    <Text
                      style={[
                        styles.roleOptionText,
                        { color: themeColors.text },
                        selected && { color: themeColors.primaryDark },
                      ]}
                    >
                      {roleItem.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        {registrationType !== 'doctor' ? (
          <>
            <AppSelect
              items={genders.map((gender) => ({ label: gender.replace(/_/g, ' '), value: gender }))}
              label="Gender"
              onValueChange={(gender) => setForm((current) => ({ ...current, gender }))}
              value={form.gender}
            />
            <AppInput
              label="Address"
              multiline
              onChangeText={(address) => setForm((current) => ({ ...current, address }))}
              placeholder="Enter your address"
              value={form.address}
            />
          </>
        ) : null}

        {registrationType === 'doctor' ? (
          <>
            <AppSelect
              items={specializationOptions}
              label="Specialization"
              onValueChange={(specialization) => setForm((current) => ({ ...current, specialization }))}
              value={form.specialization}
            />
            <AppInput
              autoCapitalize="characters"
              label="NIC"
              onChangeText={(nic) => setForm((current) => ({ ...current, nic }))}
              placeholder="200012345678 or 123456789V"
              value={form.nic}
            />
          </>
        ) : null}

        {registrationType === 'staff' ? (
          <>
            <AppInput
              autoCapitalize="characters"
              label="NIC"
              onChangeText={(nic) => setForm((current) => ({ ...current, nic }))}
              placeholder="200012345678 or 123456789V"
              value={form.nic}
            />
          </>
        ) : null}

        {error ? <Text style={[styles.error, { color: themeColors.danger }]}>{error}</Text> : null}

        <AppButton loading={submitting} onPress={handleSubmit} title="Register" />

        {registrationType === 'patient' ? (
          <View style={[styles.altRegisterBlock, { borderTopColor: themeColors.border }]}>
            <Text style={[styles.altLabel, { color: themeColors.textMuted }]}>Not a patient?</Text>
            <View style={styles.altLinks}>
              <Pressable onPress={() => navigation.push('Register', { registrationType: 'doctor' })}>
                <Text style={styles.link}>Doctor registration</Text>
              </Pressable>
              <Pressable onPress={() => navigation.push('Register', { registrationType: 'staff' })}>
                <Text style={styles.link}>Staff registration</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => navigation.replace('Register', { registrationType: 'patient' })} style={styles.linkRow}>
            <Text style={styles.link}>Back to patient registration</Text>
          </Pressable>
        )}

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkRow}>
          <Text style={[styles.linkLabel, { color: themeColors.textMuted }]}>Already have an account?</Text>
          <Text style={styles.link}> Login</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate('Landing')} style={styles.linkRow}>
          <Text style={styles.link}>Back to home</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subheading: {
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  passwordCard: {
    backgroundColor: '#F8FBFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  passwordStrengthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  passwordStrengthLabel: {
    color: colors.text,
    fontWeight: '700',
  },
  passwordStrengthValue: {
    fontWeight: '800',
  },
  passwordMeter: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  passwordMeterSegment: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordHelp: {
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  passwordChecklist: {
    gap: spacing.xs,
  },
  passwordCheckItem: {
    color: colors.textMuted,
    fontSize: 13,
  },
  passwordCheckItemActive: {
    color: colors.success,
    fontWeight: '700',
  },
  altRegisterBlock: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  altLabel: {
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  altLinks: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  linkLabel: {
    color: colors.textMuted,
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
  },
  roleCard: {
    backgroundColor: '#F8FBFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  roleLabel: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  roleHelp: {
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  roleOptions: {
    gap: spacing.sm,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  roleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#ECFEFF',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primaryDark,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primaryDark,
  },
  roleOptionText: {
    color: colors.text,
    fontWeight: '700',
  },
  roleOptionTextSelected: {
    color: colors.primaryDark,
  },
});
