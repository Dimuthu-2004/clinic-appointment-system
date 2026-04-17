import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import AppButton from '../components/AppButton';
import EmptyState from '../components/EmptyState';
import EntityCard from '../components/EntityCard';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, useTheme } from '../theme';
import { getTodayDateKey, toDateKey } from '../utils/clinicSchedule';
import { formatDateOnly, formatDateTime } from '../utils/date';

export default function ReviewListScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const isFocused = useIsFocused();
  const [appointments, setAppointments] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFeedbackData = async () => {
      try {
        setLoading(true);

        if (user?.role === 'patient') {
          const [appointmentsResponse, reviewsResponse] = await Promise.all([
            api.get('/appointments'),
            api.get('/reviews'),
          ]);

          setAppointments(appointmentsResponse.data.data || []);
          setReviews(reviewsResponse.data.data || []);
        } else {
          const reviewsResponse = await api.get('/reviews');
          setReviews(reviewsResponse.data.data || []);
        }
      } catch (error) {
        Alert.alert('Unable to load feedback', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (isFocused) {
      loadFeedbackData();
    }
  }, [isFocused, user?.role]);

  const reviewsByAppointmentId = useMemo(() => {
    const map = new Map();

    reviews.forEach((review) => {
      if (review.appointment?._id) {
        map.set(String(review.appointment._id), review);
      }
    });

    return map;
  }, [reviews]);

  const feedbackAppointments = useMemo(() => {
    if (user?.role !== 'patient') {
      return [];
    }

    return appointments
      .filter(
        (appointment) =>
          appointment.status !== 'cancelled' &&
          toDateKey(appointment.appointmentDate) <= getTodayDateKey()
      )
      .sort((left, right) => new Date(right.appointmentDate) - new Date(left.appointmentDate));
  }, [appointments, user?.role]);

  if (loading) {
    return <LoadingOverlay message="Loading feedback..." />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={[styles.title, { color: themeColors.text }]}>Feedback</Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          {user?.role === 'patient'
            ? 'Open any appointment on or before today to add feedback and check for admin replies.'
            : user?.role === 'admin'
              ? 'Read patient feedback and send replies from one place.'
              : 'See the feedback patients shared about their visits.'}
        </Text>
      </View>

      {user?.role === 'patient' ? (
        feedbackAppointments.length === 0 ? (
          <EmptyState
            message="Feedback becomes available once you have appointments on or before today."
            title="No appointments ready for feedback"
          />
        ) : (
          feedbackAppointments.map((appointment) => {
            const review = reviewsByAppointmentId.get(String(appointment._id));

            return (
              <EntityCard
                key={appointment._id}
                meta={[
                  `Doctor: Dr ${appointment.doctor?.firstName} ${appointment.doctor?.lastName}`,
                  `Date: ${formatDateTime(appointment.appointmentDate)}`,
                  ...(appointment.tokenNumber ? [`Token: ${appointment.tokenNumber}`] : []),
                  review ? `Your rating: ${review.rating}/5` : 'Feedback status: Not added yet',
                ]}
                onPress={() => navigation.navigate('ReviewForm', { appointment, review })}
                status={review ? 'completed' : 'active'}
                subtitle={
                  review?.adminReply
                    ? `Admin reply: ${review.adminReply}`
                    : review
                      ? review.comment
                      : 'Open this appointment to add feedback.'
                }
                title={formatDateOnly(appointment.appointmentDate)}
                footer={
                  <AppButton
                    onPress={() => navigation.navigate('ReviewForm', { appointment, review })}
                    title={review ? 'Update feedback' : 'Add feedback'}
                    variant={review ? 'secondary' : 'primary'}
                  />
                }
              />
            );
          })
        )
      ) : reviews.length === 0 ? (
        <EmptyState message="No feedback has been submitted yet." title="No feedback available" />
      ) : (
        reviews.map((review) => (
          <EntityCard
            key={review._id}
            meta={[
              `Doctor: Dr ${review.doctor?.firstName} ${review.doctor?.lastName}`,
              `Patient: ${review.patient?.firstName} ${review.patient?.lastName}`,
              `Rating: ${review.rating}/5`,
            ]}
            onPress={() => navigation.navigate('ReviewForm', { review })}
            status={review.adminReply ? 'completed' : 'active'}
            subtitle={review.comment}
            title={`Visit on ${formatDateOnly(review.appointment?.appointmentDate || review.createdAt)}`}
            footer={
              user?.role === 'admin' ? (
                <AppButton
                  onPress={() => navigation.navigate('ReviewForm', { review })}
                  title={review.adminReply ? 'Update reply' : 'Reply'}
                  variant="secondary"
                />
              ) : null
            }
          />
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textMuted,
    lineHeight: 22,
  },
});
