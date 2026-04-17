import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import api from '../api/client';
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
  });

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
        minAge: form.minAge === '' ? '' : Number(form.minAge),
        maxAge: form.maxAge === '' ? '' : Number(form.maxAge),
        targetCondition: form.targetCondition.trim(),
      };

      if (existingAlert?._id) {
        await api.put(`/alerts/${existingAlert._id}`, payload);
      } else {
        await api.post('/alerts', payload);
      }
      Alert.alert('Saved', 'Alert saved successfully.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Unable to save alert.');
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
              Age range: {form.minAge || form.maxAge ? `${form.minAge || 'Any'} - ${form.maxAge || 'Any'}` : 'All ages'}
            </Text>
            <Text style={[styles.readonlyText, { color: themeColors.text }]}>
              Target condition: {form.targetCondition || 'All patients'}
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
            <AppInput
              editable={canEdit}
              error={errors.minAge}
              keyboardType="numeric"
              label="Minimum age (optional)"
              onChangeText={(minAge) => setForm((current) => ({ ...current, minAge }))}
              placeholder="Example: 18"
              value={form.minAge}
            />
            <AppInput
              editable={canEdit}
              error={errors.maxAge}
              keyboardType="numeric"
              label="Maximum age (optional)"
              onChangeText={(maxAge) => setForm((current) => ({ ...current, maxAge }))}
              placeholder="Example: 65"
              value={form.maxAge}
            />
            <AppInput
              editable={canEdit}
              label="Target condition (optional)"
              onChangeText={(targetCondition) => setForm((current) => ({ ...current, targetCondition }))}
              placeholder="Example: diabetes"
              value={form.targetCondition}
            />
          </>
        ) : null}

        {canEdit ? (
          <View style={styles.actions}>
            <AppButton loading={submitting} onPress={handleSave} title="Save alert" />
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
  actions: {
    gap: spacing.md,
  },
});
