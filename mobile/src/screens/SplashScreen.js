import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../theme';

export default function SplashScreen() {
  return (
    <LinearGradient colors={['#083344', '#0E7490', '#14B8A6']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.kicker}>Clinic Appointment System</Text>
        <Text style={styles.title}>Care coordination, appointments, records, and follow-up in one app.</Text>
      </View>
      <View style={styles.loader}>
        <ActivityIndicator color={colors.surface} size="large" />
        <Text style={styles.loaderText}>Loading app...</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 120,
    paddingHorizontal: spacing.xl,
  },
  kicker: {
    color: '#CFFAFE',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: colors.surface,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loaderText: {
    color: colors.surface,
  },
});
