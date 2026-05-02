import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { isStrongPassword, isValidEmail, passwordRequirementsMessage } from '../utils/validation';

export default function ForgotPasswordScreen({ navigation, route }) {
  const { colors: themeColors } = useTheme();
  const { user, requestPasswordReset, resetPassword } = useAuth();
  const initialEmail = useMemo(
    () => String(route.params?.email || user?.email || '').trim().toLowerCase(),
    [route.params?.email, user?.email]
  );
  const [form, setForm] = useState({
    email: initialEmail,
    resetCode: '',
    password: '',
    confirmPassword: '',
  });
  const [codeRequested, setCodeRequested] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async () => {
    if (!isValidEmail(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      setSendingCode(true);
      setError('');
      await requestPasswordReset(form.email);
      setCodeRequested(true);
      Alert.alert(
        'Check your email',
        'If that email exists in Smart Clinic, a 6-digit reset code has been sent.'
      );
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Unable to send reset code.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isValidEmail(form.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!/^\d{6}$/.test(String(form.resetCode || '').trim())) {
      setError('Enter the 6-digit reset code from your email.');
      return;
    }

    if (!isStrongPassword(form.password)) {
      setError(passwordRequirementsMessage);
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setResetting(true);
      setError('');
      await resetPassword({
        email: form.email,
        resetCode: form.resetCode,
        password: form.password,
      });
      Alert.alert('Password updated', 'Your password was reset successfully. You can now sign in.');
      navigation.navigate(user ? 'Profile' : 'Login');
    } catch (resetError) {
      setError(resetError?.response?.data?.message || resetError?.message || 'Unable to reset password.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Forgot password</Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          Enter your email to receive a 6-digit reset code, then choose a new password.
        </Text>

        <AppInput
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={(email) => setForm((current) => ({ ...current, email }))}
          placeholder="patient@clinic.com"
          value={form.email}
        />

        {codeRequested ? (
          <>
            <AppInput
              keyboardType="number-pad"
              label="Reset code"
              onChangeText={(resetCode) => setForm((current) => ({ ...current, resetCode }))}
              placeholder="6-digit code"
              value={form.resetCode}
            />
            <AppInput
              label="New password"
              onChangeText={(password) => setForm((current) => ({ ...current, password }))}
              placeholder="Enter a strong password"
              secureTextEntry
              value={form.password}
            />
            <AppInput
              label="Confirm new password"
              onChangeText={(confirmPassword) => setForm((current) => ({ ...current, confirmPassword }))}
              placeholder="Re-enter the new password"
              secureTextEntry
              value={form.confirmPassword}
            />
            <Text style={[styles.hint, { color: themeColors.textMuted }]}>{passwordRequirementsMessage}</Text>
          </>
        ) : null}

        {error ? <Text style={[styles.error, { color: themeColors.danger }]}>{error}</Text> : null}

        <View style={styles.actions}>
          {!codeRequested ? (
            <AppButton loading={sendingCode} onPress={handleSendCode} title="Send reset code" />
          ) : (
            <>
              <AppButton loading={resetting} onPress={handleResetPassword} title="Reset password" />
              <AppButton
                loading={sendingCode}
                onPress={handleSendCode}
                title="Resend code"
                variant="secondary"
              />
            </>
          )}
          <AppButton
            onPress={() => navigation.goBack()}
            title={user ? 'Back to profile' : 'Back to login'}
            variant="secondary"
          />
        </View>

        {!user ? (
          <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkRow}>
            <Text style={[styles.linkLabel, { color: themeColors.textMuted }]}>Remembered it?</Text>
            <Text style={styles.link}> Sign in</Text>
          </Pressable>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
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
    marginBottom: spacing.lg,
  },
  hint: {
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  actions: {
    gap: spacing.md,
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
});
