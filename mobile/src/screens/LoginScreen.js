import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';

WebBrowser.maybeCompleteAuthSession();

const isRunningInExpoGo = () =>
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo';

const getGoogleConfigError = () => {
  if (Platform.OS === 'android') {
    return 'Google sign-in is not configured in this APK. Rebuild with EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID set.';
  }

  if (Platform.OS === 'ios') {
    return 'Google sign-in is not configured in this app build. Rebuild with EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID set.';
  }

  return 'Google sign-in is not configured in this build yet.';
};

function GoogleSignInButton({ disabled, googleClientIds, onError, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    ...googleClientIds,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    let isActive = true;

    const handleGoogleResponse = async () => {
      if (!googleResponse) {
        return;
      }

      if (googleResponse.type === 'cancel' || googleResponse.type === 'dismiss') {
        if (isActive) {
          setSubmitting(false);
        }
        return;
      }

      if (googleResponse.type === 'error') {
        if (isActive) {
          setSubmitting(false);
          onError(googleResponse.params?.error_description || 'Google sign-in failed');
        }
        return;
      }

      if (googleResponse.type !== 'success') {
        return;
      }

      const idToken = googleResponse.params?.id_token || googleResponse.authentication?.idToken;

      if (!idToken) {
        if (isActive) {
          setSubmitting(false);
          onError('Google sign-in did not return an ID token.');
        }
        return;
      }

      try {
        onError('');
        await onSuccess(idToken);
      } catch (submitError) {
        if (isActive) {
          onError(
            submitError?.response?.data?.message ||
              submitError?.message ||
              'Google sign-in failed'
          );
        }
      } finally {
        if (isActive) {
          setSubmitting(false);
        }
      }
    };

    handleGoogleResponse();

    return () => {
      isActive = false;
    };
  }, [googleResponse, onError, onSuccess]);

  const handleGoogleSubmit = async () => {
    if (isRunningInExpoGo()) {
      onError('Google sign-in requires a development build or APK. Expo Go cannot complete this login.');
      return;
    }

    if (!googleRequest) {
      onError('Google sign-in is still loading. Please try again in a moment.');
      return;
    }

    try {
      onError('');
      setSubmitting(true);
      const result = await promptGoogleAsync();

      if (result.type === 'cancel' || result.type === 'dismiss') {
        setSubmitting(false);
      } else if (result.type === 'error') {
        setSubmitting(false);
        onError(result.params?.error_description || 'Google sign-in failed');
      }
    } catch (submitError) {
      setSubmitting(false);
      onError(submitError?.message || 'Google sign-in failed');
    }
  };

  return (
    <AppButton
      disabled={disabled}
      loading={submitting}
      onPress={handleGoogleSubmit}
      title="Continue with Google"
      variant="outline"
    />
  );
}

export default function LoginScreen({ navigation }) {
  const { colors: themeColors } = useTheme();
  const { signIn, signInWithGoogle } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const googleClientIds = {
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  };
  const googleSignInConfigured =
    (Platform.OS === 'android' && Boolean(googleClientIds.androidClientId)) ||
    (Platform.OS === 'ios' && Boolean(googleClientIds.iosClientId)) ||
    (Platform.OS === 'web' && Boolean(googleClientIds.webClientId));

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
          {googleSignInConfigured ? (
            <GoogleSignInButton
              disabled={submitting}
              googleClientIds={googleClientIds}
              onError={setError}
              onSuccess={signInWithGoogle}
            />
          ) : (
            <AppButton
              disabled={submitting}
              onPress={() => setError(getGoogleConfigError())}
              title="Continue with Google"
              variant="outline"
            />
          )}
          <AppButton
            title="Forgot password"
            variant="secondary"
            onPress={() => navigation.navigate('ForgotPassword', { email: form.email })}
          />
          <AppButton title="Back to home" variant="secondary" onPress={() => navigation.navigate('Landing')} />
        </View>

        <Text style={[styles.helperText, { color: themeColors.textMuted }]}>
          Google sign-in creates a patient account the first time and lets the patient update the rest of the profile later.
        </Text>

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
  helperText: {
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 20,
    textAlign: 'center',
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
