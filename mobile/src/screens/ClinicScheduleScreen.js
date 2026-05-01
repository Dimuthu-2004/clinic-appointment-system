import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import api from '../api/client';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { setClinicHours } from '../utils/clinicSchedule';

const createEmptySchedule = () => ({
  weekday: {
    morning: { label: 'Morning', startTime: '', endTime: '', isOpen: true },
    evening: { label: 'Evening', startTime: '', endTime: '', isOpen: true },
  },
  saturday: {
    morning: { label: 'Morning', startTime: '', endTime: '', isOpen: true },
    evening: { label: 'Evening', startTime: '', endTime: '', isOpen: true },
  },
  sunday: {
    morning: { label: 'Morning', startTime: '', endTime: '', isOpen: true },
    evening: { label: 'Evening', startTime: '', endTime: '', isOpen: false },
  },
});

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const sectionTitles = {
  weekday: 'Weekdays (Monday to Friday)',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export default function ClinicScheduleScreen() {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const canEdit = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(createEmptySchedule());

  useEffect(() => {
    const loadConfig = async () => {
      try {
        setLoading(true);
        const response = await api.get('/app-settings/clinic-config');
        const clinicHours = response.data.data?.clinicHours || [];
        const nextForm = createEmptySchedule();

        clinicHours.forEach((group) => {
          if (!nextForm[group.key]) {
            return;
          }

          group.sessions.forEach((session) => {
            if (!nextForm[group.key][session.value]) {
              return;
            }

            nextForm[group.key][session.value] = {
              label: session.label,
              startTime: session.startTime,
              endTime: session.endTime,
              isOpen: session.isOpen !== false,
            };
          });
        });

        setClinicHours(clinicHours);
        setForm(nextForm);
      } catch (error) {
        Alert.alert('Unable to load clinic hours', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, []);

  const updateField = (bucket, session, field, value) => {
    setForm((current) => ({
      ...current,
      [bucket]: {
        ...current[bucket],
        [session]: {
          ...current[bucket][session],
          [field]: value,
        },
      },
    }));
  };

  const handleSave = async () => {
    const entries = Object.entries(form).flatMap(([bucket, sessions]) =>
      Object.entries(sessions).map(([sessionKey, session]) => ({
        bucket,
        sessionKey,
        session,
      }))
    );

    for (const entry of entries) {
      if (!timeRegex.test(entry.session.startTime) || !timeRegex.test(entry.session.endTime)) {
        Alert.alert('Invalid time', 'Please use 24-hour time like 06:00 or 19:30.');
        return;
      }

      if (entry.session.isOpen && entry.session.startTime >= entry.session.endTime) {
        Alert.alert('Invalid range', 'Each session start time must be earlier than its end time.');
        return;
      }
    }

    try {
      setSaving(true);
      const response = await api.put('/app-settings/clinic-config', {
        clinicSchedule: form,
      });
      setClinicHours(response.data.data?.clinicHours || []);
      Alert.alert('Saved', 'Clinic opening hours updated successfully.');
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Unable to update clinic hours.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="Loading clinic hours..." />;
  }

  return (
    <ScreenContainer>
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Clinic opening hours</Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          {canEdit
            ? 'Update the morning and evening session times here. Booking and availability rules will follow these hours.'
            : 'View the clinic opening hours used for bookings and doctor availability.'}
        </Text>

        {Object.entries(sectionTitles).map(([bucket, label]) => (
          <View key={bucket} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.primaryDark }]}>{label}</Text>
            {['morning', 'evening'].map((sessionKey) => (
              <View key={`${bucket}-${sessionKey}`} style={[styles.sessionCard, { backgroundColor: themeColors.surfaceMuted }]}>
                <Text style={[styles.sessionTitle, { color: themeColors.text }]}>{form[bucket][sessionKey].label}</Text>
                <View style={[styles.sessionToggleRow, { borderColor: themeColors.border }]}>
                  <View style={styles.sessionToggleCopy}>
                    <Text style={[styles.sessionToggleTitle, { color: themeColors.text }]}>Session open</Text>
                    <Text style={[styles.sessionToggleHint, { color: themeColors.textMuted }]}>
                      {form[bucket][sessionKey].isOpen ? 'Appointments can be booked in this session.' : 'This session is closed.'}
                    </Text>
                  </View>
                  <Switch
                    disabled={!canEdit}
                    onValueChange={(value) => updateField(bucket, sessionKey, 'isOpen', value)}
                    value={form[bucket][sessionKey].isOpen}
                  />
                </View>
                <AppInput
                  editable={canEdit}
                  label="Start time"
                  onChangeText={(value) => updateField(bucket, sessionKey, 'startTime', value)}
                  placeholder="06:00"
                  value={form[bucket][sessionKey].startTime}
                />
                <AppInput
                  editable={canEdit}
                  label="End time"
                  onChangeText={(value) => updateField(bucket, sessionKey, 'endTime', value)}
                  placeholder="08:00"
                  value={form[bucket][sessionKey].endTime}
                />
              </View>
            ))}
          </View>
        ))}

        {canEdit ? <AppButton loading={saving} onPress={handleSave} title="Save clinic hours" /> : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontWeight: '800',
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  sessionCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  sessionToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sessionToggleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  sessionToggleTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  sessionToggleHint: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  sessionTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
});
