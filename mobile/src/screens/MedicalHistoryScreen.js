import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import VitalsTrendSection from '../components/VitalsTrendSection';
import { colors, radii, spacing, useTheme } from '../theme';
import { formatDateOnly, formatDateTime } from '../utils/date';

export default function MedicalHistoryScreen({ route }) {
  const { colors: themeColors } = useTheme();
  const isFocused = useIsFocused();
  const patientId = route.params?.patientId;
  const patientName = route.params?.patientName || 'Patient';
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const cardAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const loadHistory = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/medical-records/${patientId}/history`);
        setHistory(response.data.data);
      } catch (error) {
        Alert.alert('Unable to load history', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [isFocused, patientId]);

  useEffect(() => {
    if (loading || !history) {
      return;
    }

    cardAnimation.setValue(0);
    Animated.timing(cardAnimation, {
      toValue: 1,
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [cardAnimation, history, loading]);

  if (loading) {
    return <LoadingOverlay message="Loading medical history..." />;
  }

  if (!history) {
    return (
      <ScreenContainer>
        <EmptyState message="No medical history could be loaded." title="History unavailable" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Animated.View
        style={[
          styles.heroCard,
          {
            opacity: cardAnimation,
            transform: [
              {
                translateY: cardAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.heroLabel}>Patient history</Text>
        <Text style={styles.heroTitle}>{patientName}</Text>
        <Text style={styles.heroMeta}>
          Visits: {history.visitSummary?.length || 0} | Records: {history.records?.length || 0}
        </Text>
      </Animated.View>

      <Section title="Visit summary">
        {history.visitSummary?.length ? (
          <VisitTimeline
            items={history.visitSummary.map((item, index) => ({
              step: index + 1,
              label: formatDateOnly(item.date),
              tokenLabel: `Token ${item.tokenNumber || '-'}`,
              session: item.session || 'Session not set',
              status: item.status || 'scheduled',
            }))}
          />
        ) : (
          <EmptyState message="No past visits are available for this patient." title="No visits" />
        )}
      </Section>

      <Section title="Clinical vitals trends">
        <VitalsTrendSection items={history.vitalsSummary || []} />
      </Section>

      <Section title="Medical record timeline">
        {history.records?.length ? (
          history.records.map((record, index) => (
            <Animated.View
              key={record._id}
              style={[
                styles.recordCard,
                { backgroundColor: themeColors.surface, borderColor: themeColors.border },
                {
                  opacity: cardAnimation,
                  transform: [
                    {
                      translateY: cardAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20 + index * 4, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={[styles.recordDate, { color: themeColors.textMuted }]}>{formatDateTime(record.createdAt)}</Text>
              <Text style={[styles.recordDiagnosis, { color: themeColors.text }]}>{record.diagnosis}</Text>
              {record.notes ? <Text style={[styles.recordBody, { color: themeColors.text }]}>Notes: {record.notes}</Text> : null}
              {record.treatmentPlan ? <Text style={[styles.recordBody, { color: themeColors.text }]}>Plan: {record.treatmentPlan}</Text> : null}
              <Text style={[styles.recordVitals, { color: themeColors.primaryDark }]}>
                Vitals: {formatVitalsInline(record.clinicalVitals)}
              </Text>
            </Animated.View>
          ))
        ) : (
          <EmptyState message="No medical records exist for this patient yet." title="No timeline" />
        )}
      </Section>
    </ScreenContainer>
  );
}

function Section({ title, children }) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function VisitTimeline({ items }) {
  const { colors: themeColors, isDark } = useTheme();

  return (
    <View style={[styles.chartCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.timelineRow}>
          {items.map((item, index) => (
            <View key={`${item.label}-${item.step}`} style={styles.timelineNode}>
              <View style={styles.timelineTrackRow}>
                <View
                  style={[
                    styles.timelineTrack,
                    { backgroundColor: index === 0 ? 'transparent' : themeColors.primary },
                  ]}
                />
                <View style={[styles.timelineDot, { backgroundColor: themeColors.primaryDark }]}>
                  <Text style={styles.timelineDotLabel}>{item.step}</Text>
                </View>
                <View
                  style={[
                    styles.timelineTrack,
                    { backgroundColor: index === items.length - 1 ? 'transparent' : themeColors.primary },
                  ]}
                />
              </View>
              <View
                style={[
                  styles.timelineCard,
                  {
                    backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC',
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <Text style={[styles.timelineDate, { color: themeColors.text }]}>{item.label}</Text>
                <Text style={[styles.timelineToken, { color: themeColors.primaryDark }]}>{item.tokenLabel}</Text>
                <Text style={[styles.timelineMeta, { color: themeColors.textMuted }]}>{item.session}</Text>
                <Text style={[styles.timelineMeta, { color: themeColors.textMuted }]}>
                  Status: {String(item.status).replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function formatVitalsInline(vitals = {}) {
  const parts = [];

  if (vitals.bloodPressure) {
    parts.push(`BP ${vitals.bloodPressure}`);
  }
  if (vitals.heartRate !== null && vitals.heartRate !== undefined) {
    parts.push(`HR ${vitals.heartRate} bpm`);
  }
  if (vitals.respiratoryRate !== null && vitals.respiratoryRate !== undefined) {
    parts.push(`RR ${vitals.respiratoryRate}/min`);
  }
  if (vitals.temperatureCelsius !== null && vitals.temperatureCelsius !== undefined) {
    parts.push(`Temp ${Number(vitals.temperatureCelsius).toFixed(1)} C`);
  }
  if (vitals.oxygenSaturation !== null && vitals.oxygenSaturation !== undefined) {
    parts.push(`O2 ${vitals.oxygenSaturation}%`);
  }
  if (vitals.weightKg !== null && vitals.weightKg !== undefined) {
    parts.push(`Wt ${vitals.weightKg} kg`);
  }
  if (vitals.heightCm !== null && vitals.heightCm !== undefined) {
    parts.push(`Ht ${vitals.heightCm} cm`);
  }

  return parts.length ? parts.join(' | ') : 'No vitals entered';
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroLabel: {
    color: '#BAE6FD',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    color: colors.surface,
    fontSize: 26,
    fontWeight: '800',
  },
  heroMeta: {
    color: '#E0F2FE',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timelineNode: {
    width: 184,
  },
  timelineTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  timelineTrack: {
    flex: 1,
    height: 2,
    borderRadius: 999,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  timelineDotLabel: {
    color: colors.surface,
    fontSize: 11,
    fontWeight: '800',
  },
  timelineCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    minHeight: 112,
  },
  timelineDate: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  timelineToken: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  timelineMeta: {
    color: colors.textMuted,
    lineHeight: 19,
  },
  recordCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  recordDate: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  recordDiagnosis: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  recordBody: {
    color: colors.text,
    lineHeight: 21,
    marginBottom: spacing.xs,
  },
  recordVitals: {
    color: colors.primaryDark,
    lineHeight: 21,
    marginTop: spacing.sm,
    fontWeight: '700',
  },
});
