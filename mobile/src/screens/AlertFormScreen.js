import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api, { extractErrorMessage } from '../api/client';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { formatDateTime } from '../utils/date';

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
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    title: existingAlert?.title || '',
    message: existingAlert?.message || '',
    minAge:
      existingAlert?.minAge === null || existingAlert?.minAge === undefined
        ? existingAlert?.ageLimit === null || existingAlert?.ageLimit === undefined
          ? ''
          : String(existingAlert.ageLimit)
        : String(existingAlert.minAge),
    maxAge: existingAlert?.maxAge === null || existingAlert?.maxAge === undefined ? '' : String(existingAlert.maxAge),
    targetCondition: existingAlert?.targetCondition || '',
    sendToAll: Boolean(existingSendToAll),
  });

  const hasTargetingFilters = () =>
    form.minAge !== '' || form.maxAge !== '' || form.targetCondition.trim().length > 0;

  const handleSave = async () => {
    const nextErrors = {};

    if (!form.title || !form.message) {
      Alert.alert('Missing fields', 'Please complete the title and message.');
      return;
    }

    const minAge = form.minAge === '' ? null : Number(form.minAge);
    const maxAge = form.maxAge === '' ? null : Number(form.maxAge);

    if (form.minAge !== '' && (!Number.isFinite(minAge) || minAge < 0)) {
      nextErrors.minAge = 'Minimum age cannot be negative';
    }

    if (form.maxAge !== '' && (!Number.isFinite(maxAge) || maxAge <= 0 || maxAge > 120)) {
      nextErrors.maxAge = 'Maximum age must be between 1 and 120';
    }

    if (minAge !== null && maxAge !== null && minAge >= maxAge) {
      nextErrors.minAge = 'Minimum age must be less than maximum age';
      nextErrors.maxAge = 'Maximum age must be greater than minimum age';
    }

    if (!form.sendToAll && !hasTargetingFilters()) {
      nextErrors.targetCondition = 'Add an age limit or target condition, or select Send to all users.';
    }

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
        minAge: form.sendToAll || form.minAge === '' ? '' : Number(form.minAge),
        maxAge: form.sendToAll || form.maxAge === '' ? '' : Number(form.maxAge),
        targetCondition: form.sendToAll ? '' : form.targetCondition.trim(),
        sendToAll: form.sendToAll,
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
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Alert details</Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>Send a clinic alert to all patients or a targeted group.</Text>

        {!canEdit ? (
          <>
            <Text style={[styles.readonlyText, { color: themeColors.text }]}>Title: {form.title}</Text>
            <Text style={[styles.readonlyText, { color: themeColors.text }]}>Message: {form.message}</Text>
            <Text style={[styles.readonlyText, { color: themeColors.text }]}>
              Audience: {form.sendToAll ? 'All users' : 'Targeted users'}
            </Text>
            <Text style={[styles.readonlyText, { color: themeColors.text }]}>
              Age range: {form.sendToAll ? 'All ages' : form.minAge || form.maxAge ? `${form.minAge || 'Any'} - ${form.maxAge || 'Any'}` : 'All ages'}
            </Text>
            <Text style={[styles.readonlyText, { color: themeColors.text }]}>
              Target condition: {form.sendToAll ? 'All users' : form.targetCondition || 'All patients'}
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
                accessibilityState={{ checked: form.sendToAll }}
                onPress={() => {
                  setForm((current) => ({
                    ...current,
                    sendToAll: !current.sendToAll,
                  }));
                  setErrors((current) => ({
                    ...current,
                    minAge: undefined,
                    maxAge: undefined,
                    targetCondition: undefined,
                  }));
                }}
                style={styles.checkboxButton}
              >
                <Ionicons
                  color={form.sendToAll ? themeColors.primary : themeColors.textMuted}
                  name={form.sendToAll ? 'checkbox-outline' : 'square-outline'}
                  size={24}
                />
              </Pressable>
              <View style={styles.toggleContent}>
                <Text style={[styles.toggleTitle, { color: themeColors.text }]}>Send to all users</Text>
                <Text style={[styles.toggleHint, { color: themeColors.textMuted }]}>
                  Check this to publish the alert to every patient. Leave it unchecked to use age limits or a target condition.
                </Text>
              </View>
            </View>
            <AppInput
              editable={canEdit && !form.sendToAll}
              error={errors.minAge}
              keyboardType="numeric"
              label="Minimum age (optional)"
              onChangeText={(minAge) => setForm((current) => ({ ...current, minAge }))}
              placeholder={form.sendToAll ? 'Disabled while sending to all users' : 'Example: 18'}
              value={form.minAge}
            />
            <AppInput
              editable={canEdit && !form.sendToAll}
              error={errors.maxAge}
              keyboardType="numeric"
              label="Maximum age (optional)"
              onChangeText={(maxAge) => setForm((current) => ({ ...current, maxAge }))}
              placeholder={form.sendToAll ? 'Disabled while sending to all users' : 'Example: 65'}
              value={form.maxAge}
            />
            <AppInput
              editable={canEdit && !form.sendToAll}
              error={errors.targetCondition}
              label="Target condition (optional)"
              onChangeText={(targetCondition) => setForm((current) => ({ ...current, targetCondition }))}
              placeholder={form.sendToAll ? 'Disabled while sending to all users' : 'Example: diabetes'}
              value={form.targetCondition}
            />
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
  actions: {
    gap: spacing.md,
  },
});
