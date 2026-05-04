import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { extractErrorMessage } from '../api/client';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import DateTimeField from '../components/DateTimeField';
import EmptyState from '../components/EmptyState';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { formatDateTime } from '../utils/date';

const buildTargetingKey = ({ sendToAll, targetCondition }) =>
  JSON.stringify({
    sendToAll: Boolean(sendToAll),
    targetCondition: String(targetCondition || '').trim().toLowerCase(),
  });

export default function AlertFormScreen({ navigation, route }) {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const existingAlert = route.params?.alertItem || null;
  const canEdit = user?.role === 'admin';
  const existingSendToAll =
    existingAlert?.sendToAll ??
    (
      (existingAlert?.minAge ?? existingAlert?.ageLimit ?? null) === null &&
      (existingAlert?.maxAge ?? null) === null &&
      !existingAlert?.targetCondition
    );
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [errors, setErrors] = useState({});
  const [patientSearch, setPatientSearch] = useState('');
  const [previewPatients, setPreviewPatients] = useState(existingAlert?.targetedPatients || []);
  const [previewKey, setPreviewKey] = useState(
    existingAlert && !existingSendToAll
      ? buildTargetingKey({
          sendToAll: existingSendToAll,
          targetCondition: existingAlert?.targetCondition || '',
        })
      : ''
  );
  const [selectedPatientIds, setSelectedPatientIds] = useState(
    existingAlert?.targetedPatients?.map((patient) => String(patient?._id || patient)).filter(Boolean) || []
  );
  const [form, setForm] = useState({
    title: existingAlert?.title || '',
    message: existingAlert?.message || '',
    targetCondition: existingAlert?.targetCondition || '',
    expiresAt: existingAlert?.endsAt || '',
    sendToAll: Boolean(existingSendToAll),
    sendEmailNotifications: Boolean(existingAlert?.sendEmailNotifications),
  });

  const currentTargetingKey = useMemo(() => buildTargetingKey(form), [form]);

  const filteredPreviewPatients = useMemo(() => {
    const search = patientSearch.trim().toLowerCase();

    if (!search) {
      return previewPatients;
    }

    return previewPatients.filter((patient) =>
      [
        `${patient.firstName || ''} ${patient.lastName || ''}`,
        patient.email || '',
        patient.recoveryEmail || '',
        patient.phone || '',
      ].some((value) => String(value).toLowerCase().includes(search))
    );
  }, [patientSearch, previewPatients]);

  const hasTargetingFilters = () => form.targetCondition.trim().length > 0;

  const resetPreviewState = ({ clearPatients = false } = {}) => {
    setPreviewKey('');
    if (clearPatients) {
      setPreviewPatients([]);
      setSelectedPatientIds([]);
      setPatientSearch('');
    }
  };

  const updateTargeting = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    resetPreviewState({ clearPatients: true });
    setErrors((current) => ({
      ...current,
      targetCondition: undefined,
      selectedPatients: undefined,
    }));
  };

  const validateTargeting = () => {
    const nextErrors = {};

    if (!form.sendToAll && !hasTargetingFilters()) {
      nextErrors.targetCondition = 'Add a target condition, or select Send to all users.';
    }

    if (!form.sendToAll && previewKey !== currentTargetingKey) {
      nextErrors.selectedPatients = 'Preview the matching patients again before publishing.';
    }

    if (!form.sendToAll && previewKey === currentTargetingKey && selectedPatientIds.length === 0) {
      nextErrors.selectedPatients = 'Select at least one patient from the preview list.';
    }

    return nextErrors;
  };

  const handlePreview = async () => {
    const nextErrors = validateTargeting();

    delete nextErrors.selectedPatients;

    if (nextErrors.targetCondition) {
      setErrors(nextErrors);
      Alert.alert('Invalid values', 'Please correct the highlighted fields before previewing patients.');
      return;
    }

    try {
      setPreviewing(true);
      setErrors((current) => ({
        ...current,
        selectedPatients: undefined,
      }));
      const response = await api.post('/alerts/preview-targets', {
        minAge: '',
        maxAge: '',
        targetCondition: form.targetCondition.trim(),
        sendToAll: false,
      });
      const patients = response.data.data || [];
      setPreviewPatients(patients);
      setPreviewKey(currentTargetingKey);
      setSelectedPatientIds(patients.map((patient) => String(patient._id)));
      setPatientSearch('');
      if (!patients.length) {
        Alert.alert('No matches', 'No patients matched those conditions.');
      }
    } catch (error) {
      Alert.alert('Preview failed', extractErrorMessage(error, 'Unable to preview patients.'));
    } finally {
      setPreviewing(false);
    }
  };

  const togglePatientSelection = (patientId) => {
    setSelectedPatientIds((current) =>
      current.includes(patientId) ? current.filter((item) => item !== patientId) : [...current, patientId]
    );
    setErrors((current) => ({
      ...current,
      selectedPatients: undefined,
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      Alert.alert('Missing fields', 'Please complete the title and message.');
      return;
    }

    const nextErrors = validateTargeting();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      Alert.alert('Invalid values', 'Please correct the highlighted fields before saving.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        minAge: '',
        maxAge: '',
        targetCondition: form.sendToAll ? '' : form.targetCondition.trim(),
        expiresAt: form.expiresAt || '',
        sendToAll: form.sendToAll,
        sendEmailNotifications: form.sendEmailNotifications,
        selectedPatientIds: form.sendToAll ? [] : selectedPatientIds,
      };

      if (existingAlert?._id) {
        await api.put(`/alerts/${existingAlert._id}`, payload);
      } else {
        await api.post('/alerts', payload);
      }
      Alert.alert('Saved', 'Alert saved successfully.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', extractErrorMessage(error, 'Unable to save alert.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert('Delete alert', 'Are you sure you want to remove this alert?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/alerts/${existingAlert._id}`);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Delete failed', error?.response?.data?.message || 'Unable to delete alert.');
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <Text style={[styles.title, { color: themeColors.text }]}>Alert details</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
            Send a clinic alert to all patients or a targeted group.
          </Text>

          {!canEdit ? (
            <>
              <Text style={[styles.readonlyText, { color: themeColors.text }]}>Title: {form.title}</Text>
              <Text style={[styles.readonlyText, { color: themeColors.text }]}>Message: {form.message}</Text>
              <Text style={[styles.readonlyText, { color: themeColors.text }]}>
                Audience: {form.sendToAll ? 'All users' : 'Targeted users'}
              </Text>
              <Text style={[styles.readonlyText, { color: themeColors.text }]}>
                Target condition: {form.sendToAll ? 'All users' : form.targetCondition || 'All patients'}
              </Text>
              <Text style={[styles.readonlyText, { color: themeColors.text }]}>
                Email delivery: {form.sendEmailNotifications ? 'Enabled' : 'In-app only'}
              </Text>
              <Text style={[styles.readonlyText, { color: themeColors.text }]}>
                Closes: {form.expiresAt ? formatDateTime(form.expiresAt) : 'No closing time'}
              </Text>
              <Text style={[styles.readonlyText, { color: themeColors.text }]}>
                Sent: {formatDateTime(existingAlert?.createdAt)}
              </Text>
            </>
          ) : null}

          {canEdit ? (
            <>
              <AppInput
                editable={canEdit}
                label="Title"
                onChangeText={(title) => setForm((current) => ({ ...current, title }))}
                value={form.title}
              />
              <AppInput
                editable={canEdit}
                label="Message"
                multiline
                onChangeText={(message) => setForm((current) => ({ ...current, message }))}
                value={form.message}
              />

              <ToggleCard
                checked={form.sendToAll}
                hint="Check this to publish the alert to every patient. Leave it unchecked to use a target condition."
                onPress={() => {
                  const nextSendToAll = !form.sendToAll;
                  updateTargeting({
                    sendToAll: nextSendToAll,
                    ...(nextSendToAll
                      ? {
                          targetCondition: '',
                        }
                      : {}),
                  });
                }}
                themeColors={themeColors}
                title="Send to all users"
              />

              <ToggleCard
                checked={form.sendEmailNotifications}
                hint="If enabled, matching users receive both the in-app alert notification and an email."
                onPress={() =>
                  setForm((current) => ({
                    ...current,
                    sendEmailNotifications: !current.sendEmailNotifications,
                  }))
                }
                themeColors={themeColors}
                title="Send email notifications too"
              />

              <View
                style={[
                  styles.toggleCard,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <View style={styles.toggleContent}>
                  <Text style={[styles.toggleTitle, { color: themeColors.text }]}>
                    Closing date and time (optional)
                  </Text>
                  <Text style={[styles.toggleHint, { color: themeColors.textMuted }]}>
                    If you set this, patients can see the alert only from the published time until the closing time.
                  </Text>
                </View>
                {form.expiresAt ? (
                  <Pressable onPress={() => setForm((current) => ({ ...current, expiresAt: '' }))}>
                    <Text style={styles.link}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>

              <DateTimeField
                disabled={!canEdit}
                label="Alert closing date and time"
                minimumDate={new Date()}
                onChange={(expiresAt) => setForm((current) => ({ ...current, expiresAt }))}
                value={form.expiresAt}
              />

              <AppInput
                editable={canEdit && !form.sendToAll}
                error={errors.targetCondition}
                label="Target condition (optional)"
                onChangeText={(targetCondition) => updateTargeting({ targetCondition })}
                placeholder={form.sendToAll ? 'Disabled while sending to all users' : 'Example: diabetes'}
                value={form.targetCondition}
              />

              {!form.sendToAll ? (
                <View style={[styles.previewCard, { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.border }]}>
                  <View style={styles.previewHeader}>
                    <View style={styles.previewHeaderText}>
                      <Text style={[styles.previewTitle, { color: themeColors.text }]}>Preview matching patients</Text>
                      <Text style={[styles.previewHint, { color: themeColors.textMuted }]}>
                        Review the matched patients, untick anyone you want to remove, then publish.
                      </Text>
                    </View>
                    <AppButton loading={previewing} onPress={handlePreview} title="Preview patients" variant="secondary" />
                  </View>

                  {errors.selectedPatients ? (
                    <Text style={[styles.errorText, { color: themeColors.danger }]}>{errors.selectedPatients}</Text>
                  ) : null}

                  {previewPatients.length ? (
                    <>
                      <View style={styles.selectionSummary}>
                        <Text style={[styles.selectionText, { color: themeColors.textMuted }]}>
                          Selected {selectedPatientIds.length} of {previewPatients.length} matching patients
                        </Text>
                        <Pressable
                          onPress={() => setSelectedPatientIds(previewPatients.map((patient) => String(patient._id)))}
                        >
                          <Text style={styles.link}>Select all</Text>
                        </Pressable>
                      </View>
                      <AppInput
                        label="Search matched patients"
                        onChangeText={setPatientSearch}
                        placeholder="Type name, email, or phone"
                        value={patientSearch}
                      />
                      {filteredPreviewPatients.map((patient) => {
                        const patientId = String(patient._id);
                        const isSelected = selectedPatientIds.includes(patientId);

                        return (
                          <Pressable
                            key={patientId}
                            onPress={() => togglePatientSelection(patientId)}
                            style={[styles.patientRow, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}
                          >
                            <Ionicons
                              color={isSelected ? themeColors.primary : themeColors.textMuted}
                              name={isSelected ? 'checkbox-outline' : 'square-outline'}
                              size={22}
                            />
                            <View style={styles.patientText}>
                              <Text style={[styles.patientName, { color: themeColors.text }]}>
                                {patient.firstName} {patient.lastName}
                              </Text>
                              <Text style={[styles.patientMeta, { color: themeColors.textMuted }]}>
                                {patient.recoveryEmail || patient.email || 'No email'} {patient.phone ? `| ${patient.phone}` : ''}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </>
                  ) : (
                    <EmptyState
                      message="No preview results yet. Add a target condition, then preview patients."
                      title="No preview loaded"
                    />
                  )}
                </View>
              ) : null}
            </>
          ) : null}

          {canEdit ? (
            <View style={styles.actions}>
              <AppButton
                loading={submitting}
                onPress={handleSave}
                title={existingAlert ? 'Update alert' : 'Publish alert'}
              />
              {existingAlert ? <AppButton onPress={handleDelete} title="Delete" variant="danger" /> : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

function ToggleCard({ checked, title, hint, onPress, themeColors }) {
  return (
    <View
      style={[
        styles.toggleCard,
        {
          backgroundColor: themeColors.surface,
          borderColor: themeColors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onPress}
        style={styles.checkboxButton}
      >
        <Ionicons
          color={checked ? themeColors.primary : themeColors.textMuted}
          name={checked ? 'checkbox-outline' : 'square-outline'}
          size={24}
        />
      </Pressable>
      <View style={styles.toggleContent}>
        <Text style={[styles.toggleTitle, { color: themeColors.text }]}>{title}</Text>
        <Text style={[styles.toggleHint, { color: themeColors.textMuted }]}>{hint}</Text>
      </View>
    </View>
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
  readonlyText: {
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  toggleCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  checkboxButton: {
    paddingTop: 2,
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitle: {
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  toggleHint: {
    lineHeight: 20,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewHeader: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  previewHeaderText: {
    gap: spacing.xs,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  previewHint: {
    lineHeight: 20,
  },
  errorText: {
    marginBottom: spacing.md,
    fontWeight: '600',
  },
  selectionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectionText: {
    flex: 1,
  },
  patientRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  patientText: {
    flex: 1,
  },
  patientName: {
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  patientMeta: {
    lineHeight: 19,
  },
  actions: {
    gap: spacing.md,
  },
  link: {
    color: colors.primary,
    fontWeight: '700',
  },
});
