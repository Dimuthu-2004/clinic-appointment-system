import { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import EmptyState from './EmptyState';
import { colors, radii, spacing, useTheme } from '../theme';
import { formatDateOnly } from '../utils/date';

const metricConfigs = [
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm', color: '#0E7490', decimals: 0 },
  { key: 'respiratoryRate', label: 'Respiratory rate', unit: 'breaths/min', color: '#0891B2', decimals: 0 },
  { key: 'temperatureCelsius', label: 'Temperature', unit: 'C', color: '#F97316', decimals: 1 },
  { key: 'oxygenSaturation', label: 'Oxygen', unit: '%', color: '#16A34A', decimals: 0 },
  { key: 'weightKg', label: 'Weight', unit: 'kg', color: '#7C3AED', decimals: 1 },
  { key: 'heightCm', label: 'Height', unit: 'cm', color: '#DB2777', decimals: 0 },
];

export default function VitalsTrendSection({ items = [], emptyTitle = 'No vitals', emptyMessage }) {
  const fallbackMessage =
    emptyMessage || 'No clinical vitals were recorded across these visits yet.';

  return (
    <>
      <BloodPressureTrendCard items={items} />
      {metricConfigs.map((metric) => (
        <VitalsMetricCard
          key={metric.key}
          color={metric.color}
          decimals={metric.decimals}
          items={items}
          label={metric.label}
          metricKey={metric.key}
          unit={metric.unit}
        />
      ))}
      {!hasAnyTrendData(items) ? <EmptyState message={fallbackMessage} title={emptyTitle} /> : null}
    </>
  );
}

function VitalsMetricCard({ items, metricKey, label, unit, color, decimals = 0 }) {
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
          footer={`${Number(item[metricKey]).toFixed(decimals)} ${unit}`}
          label={formatDateOnly(item.date)}
          maxValue={maxValue}
          value={Number(item[metricKey])}
        />
      ))}
    </View>
  );
}

function BloodPressureTrendCard({ items }) {
  const { colors: themeColors, isDark } = useTheme();
  const filteredItems = items
    .map((item) => ({
      ...item,
      parsed: parseBloodPressure(item.bloodPressure),
    }))
    .filter((item) => item.parsed);

  if (!filteredItems.length) {
    return null;
  }

  const maxValue = Math.max(...filteredItems.flatMap((item) => [item.parsed.systolic, item.parsed.diastolic]), 1);

  return (
    <View style={[styles.metricCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <Text style={[styles.metricTitle, { color: themeColors.text }]}>Blood pressure</Text>
      {filteredItems.map((item, index) => (
        <View key={`bp-${item.recordId || index}`} style={styles.bpRow}>
          <View style={styles.barHeader}>
            <Text style={[styles.barLabel, { color: themeColors.text }]}>{formatDateOnly(item.date)}</Text>
            <Text style={[styles.barValue, { color: themeColors.textMuted }]}>
              {item.parsed.systolic}/{item.parsed.diastolic} mmHg
            </Text>
          </View>
          <View style={styles.bpBars}>
            <View style={styles.bpBarBlock}>
              <Text style={[styles.bpLegend, { color: themeColors.textMuted }]}>SYS</Text>
              <View style={[styles.barTrack, { backgroundColor: isDark ? '#244751' : '#DCEBED' }]}>
                <View
                  style={[
                    styles.barFillStatic,
                    {
                      backgroundColor: '#DC2626',
                      width: `${(item.parsed.systolic / maxValue) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
            <View style={styles.bpBarBlock}>
              <Text style={[styles.bpLegend, { color: themeColors.textMuted }]}>DIA</Text>
              <View style={[styles.barTrack, { backgroundColor: isDark ? '#244751' : '#DCEBED' }]}>
                <View
                  style={[
                    styles.barFillStatic,
                    {
                      backgroundColor: '#2563EB',
                      width: `${(item.parsed.diastolic / maxValue) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>
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

function parseBloodPressure(value) {
  if (!value) {
    return null;
  }

  const match = String(value).trim().match(/^(\d{2,3})\/(\d{2,3})$/);
  if (!match) {
    return null;
  }

  return {
    systolic: Number(match[1]),
    diastolic: Number(match[2]),
  };
}

function hasAnyTrendData(items) {
  return items.some((item) => {
    const vitals = [
      item.bloodPressure,
      item.heartRate,
      item.respiratoryRate,
      item.temperatureCelsius,
      item.oxygenSaturation,
      item.weightKg,
      item.heightCm,
    ];

    return vitals.some((value) => value !== null && value !== undefined && value !== '');
  });
}

const styles = StyleSheet.create({
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
  barFillStatic: {
    height: '100%',
    borderRadius: 999,
  },
  bpRow: {
    marginBottom: spacing.md,
  },
  bpBars: {
    gap: spacing.xs,
  },
  bpBarBlock: {
    gap: spacing.xs,
  },
  bpLegend: {
    fontSize: 12,
    fontWeight: '700',
  },
});
