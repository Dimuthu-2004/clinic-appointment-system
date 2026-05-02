import { Ionicons } from '@expo/vector-icons';
import { Animated, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import api from '../api/client';
import AppButton from '../components/AppButton';
import ScreenContainer from '../components/ScreenContainer';
import { colors, radii, shadow, spacing, useTheme } from '../theme';
import { getClinicHours, setClinicHours } from '../utils/clinicSchedule';

const featureCards = [
  {
    icon: 'calendar-clear-outline',
    title: 'Book appointments',
    description: 'Pick a date, choose a doctor, and keep your clinic visits organized.',
  },
  {
    icon: 'document-text-outline',
    title: 'View records',
    description: 'Keep your medical records, prescriptions, and follow-up details close by.',
  },
  {
    icon: 'notifications-outline',
    title: 'Stay updated',
    description: 'Get reminders for appointments, medicine, billing, and important notices.',
  },
];

const quickSteps = [
  'Choose a doctor and clinic session',
  'Sign in or register only when you are ready to confirm',
  'Return anytime to manage visits, payments, and records',
];

export default function LandingScreen({ navigation }) {
  const { colors: themeColors, isDark } = useTheme();
  const [clinicHours, updateClinicHours] = useState(getClinicHours());
  const [reviews, setReviews] = useState([]);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loadPublicData = async () => {
      try {
        const [configResponse, reviewsResponse] = await Promise.all([
          api.get('/app-settings/clinic-config'),
          api.get('/reviews/public'),
        ]);

        const nextHours = configResponse.data.data?.clinicHours || [];
        if (nextHours.length) {
          setClinicHours(nextHours);
          updateClinicHours(nextHours);
        }

        setReviews(reviewsResponse.data.data || []);
      } catch (_error) {
        updateClinicHours(getClinicHours());
      }
    };

    loadPublicData();
  }, []);

  useEffect(() => {
    if (reviews.length <= 1) {
      return undefined;
    }

    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();

      setActiveReviewIndex((current) => (current + 1) % reviews.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [fadeAnim, reviews]);

  const activeReview = reviews[activeReviewIndex] || null;

  return (
    <ScreenContainer>
      <ImageBackground
        source={require('../../assets/landing-hero-bg.png')}
        style={styles.hero}
        imageStyle={styles.heroImage}
      >
        <View style={styles.heroOverlay}>
          <Text style={styles.title}>Book your next clinic visit with ease.</Text>
          <Text style={styles.subtitle}>
            Book appointments, sign in, or create an account to manage your clinic visits with less hassle.
          </Text>

          <View style={styles.heroActions}>
            <AppButton
              title="Book an appointment"
              onPress={() => navigation.navigate('AppointmentForm')}
            />
            <AppButton title="Login" variant="outline" onPress={() => navigation.navigate('Login')} />
          </View>

          <Pressable
            onPress={() => navigation.navigate('Register', { registrationType: 'patient' })}
            style={styles.inlineLink}
          >
            <Text style={styles.inlineLinkLabel}>New here?</Text>
            <Text style={styles.inlineLinkText}> Register as a patient</Text>
          </Pressable>
        </View>
      </ImageBackground>

      <View style={[styles.stepsCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>How it works</Text>
        {quickSteps.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{index + 1}</Text>
            </View>
            <Text style={[styles.stepText, { color: themeColors.text }]}>{step}</Text>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.hoursCard,
          {
            backgroundColor: isDark ? themeColors.surfaceMuted : '#F4FBFA',
            borderColor: isDark ? themeColors.border : '#CFEAEC',
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Clinic opening hours</Text>
        {clinicHours.map((item) => (
          <View key={item.key} style={styles.hoursRow}>
            <Text style={[styles.hoursDay, { color: themeColors.primaryDark }]}>{item.label}</Text>
            {item.sessions.map((session) => (
              <Text key={`${item.key}-${session.value}`} style={[styles.hoursText, { color: themeColors.textMuted }]}>
                {session.label}: {session.timeRange}
              </Text>
            ))}
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>What you can do</Text>
      <View style={styles.featureList}>
        {featureCards.map((item) => (
          <View key={item.title} style={[styles.featureCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={[styles.featureIconWrap, { backgroundColor: isDark ? '#123C47' : '#E6FFFB' }]}>
              <Ionicons color={themeColors.primaryDark} name={item.icon} size={22} />
            </View>
            <Text style={[styles.featureTitle, { color: themeColors.text }]}>{item.title}</Text>
            <Text style={[styles.featureDescription, { color: themeColors.textMuted }]}>{item.description}</Text>
          </View>
        ))}
      </View>

      {activeReview ? (
        <View style={styles.reviewSection}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>What patients say</Text>
          <Animated.View
            style={[
              styles.reviewCard,
              { backgroundColor: themeColors.surface, borderColor: themeColors.border, opacity: fadeAnim },
            ]}
          >
            <View style={styles.reviewStars}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Ionicons
                  key={`review-star-${index}`}
                  color={index < activeReview.rating ? '#F59E0B' : '#D9E5E7'}
                  name={index < activeReview.rating ? 'star' : 'star-outline'}
                  size={18}
                />
              ))}
            </View>
            <Text style={[styles.reviewText, { color: themeColors.text }]}>"{activeReview.comment}"</Text>
            <Text style={[styles.reviewMeta, { color: themeColors.textMuted }]}>
              {activeReview.patient?.firstName} {activeReview.patient?.lastName}
            </Text>
            {activeReview.doctor ? (
              <Text style={[styles.reviewMeta, { color: themeColors.textMuted }]}>
                Dr {activeReview.doctor.firstName} {activeReview.doctor.lastName}
                {activeReview.doctor.specialization ? ` | ${activeReview.doctor.specialization}` : ''}
              </Text>
            ) : null}
          </Animated.View>
          <View style={styles.reviewDots}>
            {reviews.map((review, index) => (
              <View
                key={review._id}
                style={[
                  styles.reviewDot,
                  { backgroundColor: isDark ? '#315864' : '#D1DDE0' },
                  index === activeReviewIndex && { backgroundColor: themeColors.primaryDark, width: 24 },
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.secondaryCard,
          {
            backgroundColor: isDark ? themeColors.surfaceMuted : '#F0FDFA',
            borderColor: isDark ? themeColors.border : '#BFECE8',
          },
        ]}
      >
        <Text style={[styles.secondaryTitle, { color: themeColors.text }]}>Already registered?</Text>
        <Text style={[styles.secondaryText, { color: themeColors.textMuted }]}>
          Sign in to see your appointments, medical records, billing, alerts, and prescriptions.
        </Text>
        <AppButton title="Go to login" variant="secondary" onPress={() => navigation.navigate('Login')} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  heroImage: {
    borderRadius: radii.lg,
    resizeMode: 'cover',
  },
  heroOverlay: {
    padding: spacing.xl,
    backgroundColor: 'rgba(11, 36, 48, 0.52)',
  },
  title: {
    color: colors.surface,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: '#F0FDFA',
    lineHeight: 22,
  },
  heroActions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  inlineLink: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  inlineLinkLabel: {
    color: '#D1FAE5',
  },
  inlineLinkText: {
    color: colors.surface,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  stepsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    color: '#166534',
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    color: colors.text,
    lineHeight: 21,
  },
  hoursCard: {
    backgroundColor: '#F4FBFA',
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#CFEAEC',
    marginBottom: spacing.lg,
  },
  hoursRow: {
    marginBottom: spacing.md,
  },
  hoursDay: {
    color: colors.primaryDark,
    fontWeight: '800',
    marginBottom: 4,
  },
  hoursText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  featureList: {
    gap: spacing.md,
  },
  featureCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E6FFFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  featureTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  featureDescription: {
    color: colors.textMuted,
    lineHeight: 21,
  },
  reviewSection: {
    marginTop: spacing.lg,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: spacing.md,
  },
  reviewText: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  reviewMeta: {
    color: colors.textMuted,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  reviewDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
  },
  reviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1DDE0',
  },
  reviewDotActive: {
    width: 24,
    backgroundColor: colors.primaryDark,
  },
  secondaryCard: {
    marginTop: spacing.lg,
    backgroundColor: '#F0FDFA',
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#BFECE8',
    gap: spacing.md,
  },
  secondaryTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  secondaryText: {
    color: colors.textMuted,
    lineHeight: 21,
  },
});
