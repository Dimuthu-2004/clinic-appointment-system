import { useEffect, useState } from 'react';
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

export default function PrescriptionListScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const isFocused = useIsFocused();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const canCreate = user?.role === 'doctor';

  useEffect(() => {
    const loadPrescriptions = async () => {
      try {
        setLoading(true);
        const response = await api.get('/prescriptions');
        setPrescriptions(response.data.data);
      } catch (error) {
        Alert.alert('Unable to load prescriptions', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (isFocused) {
      loadPrescriptions();
    }
  }, [isFocused]);

  if (loading) {
    return <LoadingOverlay message="Loading prescriptions..." />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: themeColors.text }]}>Prescriptions</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
            {user?.role === 'doctor'
              ? 'Create and manage digital prescriptions for your patients.'
              : 'Review your prescribed medicines and pharmacy availability.'}
          </Text>
        </View>
        {canCreate ? (
          <AppButton title="New" onPress={() => navigation.navigate('PrescriptionForm')} />
        ) : null}
      </View>

      {prescriptions.length === 0 ? (
        <EmptyState message="No prescriptions are available yet." title="No prescriptions found" />
      ) : (
        prescriptions.map((prescription) => (
          <EntityCard
            key={prescription._id}
            meta={[
              `Patient: ${prescription.patient?.firstName} ${prescription.patient?.lastName}`,
              `Doctor: ${prescription.doctor?.firstName} ${prescription.doctor?.lastName}`,
              `Medications: ${prescription.medications?.length || 0}`,
              `Appointment: ${prescription.appointment?.appointmentDate ? new Date(prescription.appointment.appointmentDate).toLocaleDateString() : 'Not linked'}`,
            ]}
            onPress={() => navigation.navigate('PrescriptionForm', { prescription })}
            status={prescription.status}
            subtitle={
              user?.role === 'doctor'
                ? `${prescription.patient?.firstName} ${prescription.patient?.lastName}`
                : `Dr ${prescription.doctor?.firstName} ${prescription.doctor?.lastName}`
            }
            title={prescription.medications?.[0]?.name || 'Prescription'}
          />
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    lineHeight: 22,
  },
});
