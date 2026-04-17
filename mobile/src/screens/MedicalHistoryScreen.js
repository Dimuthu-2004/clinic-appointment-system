import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, StyleSheet, Text, View } from 'react-native';
import api from '../api/client';
import EmptyState from '../components/EmptyState';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { colors, radii, spacing, useTheme } from '../theme';
import { formatDateOnly, formatDateTime } from '../utils/date';

const metricConfigs = [
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm', color: '#0E7490' },
  { key: 'temperatureCelsius', label: 'Temperature', unit: 'C', color: '#F97316' },
  { key: 'oxygenSaturation', label: 'Oxygen', unit: '%', color: '#16A34A' },
  { key: 'weightKg', label: 'Weight', unit: 'kg', color: '#7C3AED' },
];

export default function MedicalHistoryScreen({ route }) {
  const { colors: themeColors } = useTheme();
  const patientId = route.params?.patientId;
  const patientName = route.params?.patientName || 'Patient';
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const cardAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [patientId]);

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
          <SimpleBarChart
            items={history.visitSummary.map((item, index) => ({
              label: formatDateOnly(item.date),
              value: index + 1,
              footer: `Token ${item.tokenNumber || '-'}`,
            }))}
          />
        ) : (
          <EmptyState message="No past visits are available for this patient." title="No visits" />
        )}
      </Section>

      <Section title="Clinical vitals">
        {metricConfigs.map((metric) => (
          <VitalsMetricCard
            key={metric.key}
            color={metric.color}
            items={history.vitalsSummary || []}
            label={metric.label}
            metricKey={metric.key}
            unit={metric.unit}
          />
        ))}
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

function SimpleBarChart({ items }) {
  const { colors: themeColors } = useTheme();
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <View style={[styles.chartCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      {items.map((item, index) => (
        <AnimatedBar
          key={`${item.label}-${index}`}
          color={themeColors.primary}
          footer={item.footer}
          label={item.label}
          maxValue={maxValue}
          value={item.value}
        />
      ))}
    </View>
  );
}

function VitalsMetricCard({ items, metricKey, label, unit, color }) {
  const { colors: themeColors } = useTheme();
  const filteredItems = items.filter((item) => item[metricKey] !== null && item[metricKey] !== undefined);

  if (!filteredItems.length) {
    return null;
  }

  const maxValue = Math.max(...filteredItems.map((item) => Number(item[metricKey] || 0)), 1);

  return (
    <View style={[styles.metricCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <Text style={[styles.metricTitle, { color: themeColors.text }]}>{label}</Text>
      {filteredItems.map((item, index) => (
        <AnimatedBar
          key={`${metricKey}-${item.recordId || index}`}
          color={color}
          footer={`${Number(item[metricKey]).toFixed(metricKey === 'temperatureCelsius' ? 1 : 0)} ${unit}`}
          label={formatDateOnly(item.date)}
          maxValue={maxValue}
          value={Number(item[metricKey])}
        />
      ))}
    </View>
  );
}

function AnimatedBar({ label, value, maxValue, footer, color }) {
  const { colors: themeColors, isDark } = useTheme();
  const widthAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnimation, {
      toValue: maxValue ? value / maxValue : 0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [maxValue, value, widthAnimation]);

  return (
    <View style={styles.barRow}>
      <View style={styles.barHeader}>
        <Text style={[styles.barLabel, { color: themeColors.text }]}>{label}</Text>
        <Text style={[styles.barValue, { color: themeColors.textMuted }]}>{footer}</Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: isDark ? '#244751' : '#DCEBED' }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              width: widthAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
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
  if (vitals.temperatureCelsius !== null && vitals.temperatureCelsius !== undefined) {
    parts.push(`Temp ${Number(vitals.temperatureCelsius).toFixed(1)} C`);
  }
  if (vitals.oxygenSaturation !== null && vitals.oxygenSaturation !== undefined) {
    parts.push(`O2 ${vitals.oxygenSaturation}%`);
  }
  if (vitals.weightKg !== null && vitals.weightKg !== undefined) {
    parts.push(`Wt ${vitals.weightKg} kg`);
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
  metricCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  metricTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  barRow: {
    marginBottom: spacing.md,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  barLabel: {
    color: colors.text,
    fontWeight: '700',
    flex: 1,
  },
  barValue: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#DCEBED',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
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
