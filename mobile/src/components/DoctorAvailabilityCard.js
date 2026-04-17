import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import api from '../api/client';
import AppButton from './AppButton';
import AppSelect from './AppSelect';
import DateTimeField from './DateTimeField';
import { colors, radii, shadow, spacing, useTheme } from '../theme';
import {
  availabilityScopeOptions,
  getClinicHours,
  formatAvailabilityScope,
  getTodayDateKey,
  setClinicHours,
} from '../utils/clinicSchedule';
import { formatDateOnly } from '../utils/date';

export default function DoctorAvailabilityCard({ active }) {
  const { colors: themeColors, isDark } = useTheme();
  const [form, setForm] = useState({
    date: getTodayDateKey(),
    sessionScope: 'morning',
    availability: 'available',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [clinicHours, updateClinicHours] = useState(getClinicHours());

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => `${left.dateKey}-${left.sessionScope}`.localeCompare(`${right.dateKey}-${right.sessionScope}`)),
    [items]
  );

  const loadAvailability = async () => {
    try {
      setLoading(true);
      const [availabilityResponse, configResponse] = await Promise.all([
        api.get('/doctor-availability'),
        api.get('/app-settings/clinic-config'),
      ]);
      const nextHours = configResponse.data.data?.clinicHours || [];
      if (nextHours.length) {
        setClinicHours(nextHours);
        updateClinicHours(nextHours);
      }
      setItems(availabilityResponse.data.data || []);
    } catch (error) {
      Alert.alert('Unable to load availability', error?.response?.data?.message || 'Try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (active) {
      loadAvailability();
    }
  }, [active]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.post('/doctor-availability', form);
      await loadAvailability();
      Alert.alert('Saved', 'Doctor availability updated successfully.');
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Unable to save availability.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <Text style={[styles.title, { color: themeColors.text }]}>Availability</Text>
      <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
        Here you can mark when you are not available for a future clinic session and keep patient bookings accurate.
      </Text>

      <AppButton
        onPress={() => setShowForm((current) => !current)}
        title={showForm ? 'Hide availability form' : 'Mark unavailability'}
        variant="secondary"
      />

      {showForm ? (
        <>
          <View style={styles.formBlock}>
            <DateTimeField
              label="Date"
              minimumDate={new Date()}
              mode="date"
              onChange={(date) => setForm((current) => ({ ...current, date }))}
              value={form.date}
            />
            <AppSelect
              items={availabilityScopeOptions}
              label="Session"
              onValueChange={(sessionScope) => setForm((current) => ({ ...current, sessionScope }))}
              value={form.sessionScope}
            />
            <View
              style={[
                styles.switchRow,
                { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC', borderColor: themeColors.border },
              ]}
            >
              <View style={styles.switchCopy}>
                <Text style={[styles.switchLabel, { color: themeColors.text }]}>Availability</Text>
                <Text style={[styles.switchHint, { color: themeColors.textMuted }]}>
                  {form.availability === 'available'
                    ? 'This session is open for patient bookings.'
                    : 'This session will be blocked for patient bookings.'}
                </Text>
              </View>
              <View style={styles.switchControl}>
                <Text
                  style={[
                    styles.switchState,
                    form.availability === 'available' ? styles.availableStatus : styles.unavailableStatus,
                  ]}
                >
                  {form.availability === 'available' ? 'Available' : 'Not available'}
                </Text>
                <Switch
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      availability: value ? 'available' : 'unavailable',
                    }))
                  }
                  thumbColor={colors.surface}
                  trackColor={{ false: '#FCA5A5', true: '#86EFAC' }}
                  value={form.availability === 'available'}
                />
              </View>
            </View>

            <AppButton loading={saving} onPress={handleSave} title="Save availability" />
          </View>

          <View style={[styles.scheduleBlock, { borderTopColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Clinic sessions</Text>
            {clinicHours.map((item) => (
              <View key={item.label} style={styles.scheduleRow}>
                <Text style={[styles.scheduleDay, { color: themeColors.primaryDark }]}>{item.label}</Text>
                {item.sessions.map((session) => (
                  <Text key={`${item.label}-${session.value}`} style={[styles.scheduleText, { color: themeColors.textMuted }]}>
                    {session.label}: {session.timeRange}
                  </Text>
                ))}
              </View>
            ))}
          </View>

          <View style={[styles.scheduleBlock, { borderTopColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Saved changes</Text>
            {loading ? (
              <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>Loading saved availability...</Text>
            ) : sortedItems.length === 0 ? (
              <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>
                No future availability changes saved yet.
              </Text>
            ) : (
              sortedItems.map((item) => (
                <View key={item._id} style={[styles.savedRow, { borderBottomColor: themeColors.border }]}>
                  <View style={styles.savedContent}>
                    <Text style={[styles.savedDate, { color: themeColors.text }]}>{formatDateOnly(item.dateKey)}</Text>
                    <Text style={[styles.savedMeta, { color: themeColors.textMuted }]}>
                      {formatAvailabilityScope(item.sessionScope)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.savedStatus,
                      item.availability === 'available' ? styles.availableStatus : styles.unavailableStatus,
                    ]}
                  >
                    {item.availability === 'available' ? 'Available' : 'Not available'}
                  </Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : (
        <View
          style={[
            styles.collapsedHint,
            { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC', borderColor: themeColors.border },
          ]}
        >
          <Text style={[styles.collapsedHintText, { color: themeColors.textMuted }]}>
            Open the form to choose a future date and mark a morning session, evening session, or the whole day.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  collapsedHint: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: '#F8FBFC',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  collapsedHintText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  formBlock: {
    marginTop: spacing.lg,
  },
  switchRow: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: '#F8FBFC',
    gap: spacing.md,
  },
  switchCopy: {
    gap: spacing.xs,
  },
  switchLabel: {
    color: colors.text,
    fontWeight: '700',
  },
  switchHint: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  switchControl: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchState: {
    fontWeight: '800',
  },
  scheduleBlock: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  scheduleRow: {
    marginBottom: spacing.sm,
  },
  scheduleDay: {
    color: colors.primaryDark,
    fontWeight: '700',
    marginBottom: 4,
  },
  scheduleText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  emptyText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  savedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  savedContent: {
    flex: 1,
  },
  savedDate: {
    color: colors.text,
    fontWeight: '700',
  },
  savedMeta: {
    color: colors.textMuted,
    marginTop: 4,
  },
  savedStatus: {
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  availableStatus: {
    color: colors.success,
  },
  unavailableStatus: {
    color: colors.danger,
  },
});
