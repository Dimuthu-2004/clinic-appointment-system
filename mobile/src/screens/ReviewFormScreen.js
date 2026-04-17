import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import api, { extractErrorMessage } from '../api/client';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import ScreenContainer from '../components/ScreenContainer';
import StarRatingInput from '../components/StarRatingInput';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { formatDateTime } from '../utils/date';

export default function ReviewFormScreen({ navigation, route }) {
  const { colors: themeColors, isDark } = useTheme();
  const { user } = useAuth();
  const existingReview = route.params?.review || null;
  const appointment = route.params?.appointment || existingReview?.appointment || null;
  const isPatient = user?.role === 'patient';
  const isAdmin = user?.role === 'admin';
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    rating: existingReview?.rating || 0,
    comment: existingReview?.comment || '',
    adminReply: existingReview?.adminReply || '',
  });

  const handleSave = async () => {
    if (isPatient) {
      if (!appointment?._id || !form.rating || form.comment.trim().length < 5) {
        Alert.alert('Missing fields', 'Please choose a rating and enter at least 5 characters of feedback.');
        return;
      }
    }

    if (isAdmin && !form.adminReply.trim()) {
      Alert.alert('Missing reply', 'Please enter a reply for the patient.');
      return;
    }

    try {
      setSubmitting(true);

      if (isPatient) {
        const payload = {
          appointment: appointment._id,
          rating: Number(form.rating),
          comment: form.comment.trim(),
        };

        if (existingReview?._id) {
          await api.put(`/reviews/${existingReview._id}`, payload);
        } else {
          await api.post('/reviews', payload);
        }
      } else if (isAdmin && existingReview?._id) {
        await api.put(`/reviews/${existingReview._id}`, {
          adminReply: form.adminReply.trim(),
        });
      } else {
        Alert.alert('Not available', 'Only patients can add feedback and admins can reply.');
        return;
      }

      Alert.alert('Saved', 'Feedback saved successfully.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', extractErrorMessage(error, 'Unable to save feedback.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert('Delete feedback', 'Are you sure you want to delete this feedback?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/reviews/${existingReview._id}`);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Delete failed', extractErrorMessage(error, 'Unable to delete feedback.'));
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          {isAdmin ? 'Reply to feedback' : existingReview ? 'Update feedback' : 'Appointment feedback'}
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          {isAdmin
            ? 'Read the patient feedback and send a reply they can see from their dashboard.'
            : 'Share your experience for this appointment.'}
        </Text>

        {appointment ? (
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: isDark ? themeColors.surfaceMuted : '#F0FDFA',
                borderColor: isDark ? themeColors.border : '#BFECE8',
              },
            ]}
          >
            <Text style={[styles.summaryTitle, { color: themeColors.primaryDark }]}>Appointment summary</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Doctor: Dr {appointment.doctor?.firstName} {appointment.doctor?.lastName}</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Date: {formatDateTime(appointment.appointmentDate)}</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Session: {appointment.appointmentSession || 'Not set'}</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Token: {appointment.tokenNumber || '-'}</Text>
          </View>
        ) : null}

        {isPatient ? (
          <>
            <StarRatingInput
              onChange={(rating) => setForm((current) => ({ ...current, rating }))}
              value={form.rating}
            />
            <AppInput
              label="Your feedback"
              multiline
              onChangeText={(comment) => setForm((current) => ({ ...current, comment }))}
              placeholder="Share your experience with this appointment"
              value={form.comment}
            />
            {existingReview?.adminReply ? (
              <View
                style={[
                  styles.replyCard,
                  { backgroundColor: isDark ? '#2E2415' : '#FFF7ED', borderColor: isDark ? '#7C4A16' : '#FED7AA' },
                ]}
              >
                <Text style={[styles.replyTitle, { color: isDark ? '#FDBA74' : '#9A3412' }]}>Admin reply</Text>
                <Text style={[styles.replyText, { color: themeColors.text }]}>{existingReview.adminReply}</Text>
              </View>
            ) : null}
            <View style={styles.actions}>
              <AppButton loading={submitting} onPress={handleSave} title="Save feedback" />
              {existingReview ? <AppButton onPress={handleDelete} title="Delete" variant="danger" /> : null}
            </View>
          </>
        ) : isAdmin && existingReview ? (
          <>
            <View style={[styles.readonlyBlock, { backgroundColor: themeColors.surfaceMuted }]}>
              <Text style={[styles.readonlyLabel, { color: themeColors.text }]}>Patient feedback</Text>
              <Text style={[styles.readonlyText, { color: themeColors.text }]}>Rating: {existingReview.rating}/5</Text>
              <Text style={[styles.readonlyText, { color: themeColors.text }]}>{existingReview.comment}</Text>
            </View>
            <AppInput
              label="Reply"
              multiline
              onChangeText={(adminReply) => setForm((current) => ({ ...current, adminReply }))}
              placeholder="Write a helpful reply for the patient"
              value={form.adminReply}
            />
            <View style={styles.actions}>
              <AppButton loading={submitting} onPress={handleSave} title="Save reply" />
            </View>
          </>
        ) : (
          <>
            <View style={[styles.readonlyBlock, { backgroundColor: themeColors.surfaceMuted }]}>
              <Text style={[styles.readonlyLabel, { color: themeColors.text }]}>Patient feedback</Text>
              <Text style={[styles.readonlyText, { color: themeColors.text }]}>Rating: {existingReview?.rating}/5</Text>
              <Text style={[styles.readonlyText, { color: themeColors.text }]}>{existingReview?.comment}</Text>
            </View>
            {user?.role === 'patient' && existingReview?.adminReply ? (
              <View
                style={[
                  styles.replyCard,
                  { backgroundColor: isDark ? '#2E2415' : '#FFF7ED', borderColor: isDark ? '#7C4A16' : '#FED7AA' },
                ]}
              >
                <Text style={[styles.replyTitle, { color: isDark ? '#FDBA74' : '#9A3412' }]}>Admin reply</Text>
                <Text style={[styles.replyText, { color: themeColors.text }]}>{existingReview.adminReply}</Text>
              </View>
            ) : null}
          </>
        )}
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
  summaryCard: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#BFECE8',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    color: colors.primaryDark,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  summaryText: {
    color: colors.text,
    lineHeight: 21,
  },
  readonlyBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  readonlyLabel: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  readonlyText: {
    color: colors.text,
    lineHeight: 22,
  },
  replyCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  replyTitle: {
    color: '#9A3412',
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  replyText: {
    color: colors.text,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
  },
});
