import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';

export default function LoginScreen({ navigation }) {
  const { colors: themeColors } = useTheme();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.email || !form.password) {
      setError('Email and password are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await signIn(form);
    } catch (submitError) {
      setError(
        submitError?.response?.data?.message ||
          submitError?.message ||
          'Login failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer contentStyle={styles.content}>
      <LinearGradient colors={['#0F172A', '#155E75', '#0EA5A4']} style={styles.hero}>
        <Text style={styles.heroTitle}>Smart Clinic</Text>
        <Text style={styles.heroText}>
          Appointments, records, billing, alerts, prescriptions, reviews, and inventory.
        </Text>
      </LinearGradient>

      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.heading, { color: themeColors.text }]}>Sign in</Text>
        <Text style={[styles.subheading, { color: themeColors.textMuted }]}>Sign in to continue.</Text>

        <AppInput
          autoCapitalize="none"
          keyboardType="email-address"
          label="Email"
          onChangeText={(email) => setForm((current) => ({ ...current, email }))}
          placeholder="patient@clinic.com"
          value={form.email}
        />
        <AppInput
          label="Password"
          onChangeText={(password) => setForm((current) => ({ ...current, password }))}
          placeholder="Enter your password"
          secureTextEntry
          value={form.password}
        />

        {error ? <Text style={[styles.error, { color: themeColors.danger }]}>{error}</Text> : null}

        <View style={styles.actions}>
          <AppButton loading={submitting} onPress={handleSubmit} title="Login" />
          <AppButton
            title="Forgot password"
            variant="secondary"
            onPress={() => navigation.navigate('ForgotPassword', { email: form.email })}
          />
          <AppButton title="Back to home" variant="secondary" onPress={() => navigation.navigate('Landing')} />
        </View>

        <Pressable
          onPress={() => navigation.navigate('Register', { registrationType: 'patient' })}
          style={styles.linkRow}
        >
          <Text style={[styles.linkLabel, { color: themeColors.textMuted }]}>Need a new account?</Text>
          <Text style={styles.link}> Register here</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  hero: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  heroText: {
    color: '#E0F2FE',
    lineHeight: 22,
  },
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
