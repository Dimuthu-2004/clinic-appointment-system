import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api from '../api/client';
import AppInput from '../components/AppInput';
import EmptyState from '../components/EmptyState';
import EntityCard from '../components/EntityCard';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, useTheme } from '../theme';
import { formatDateOnly } from '../utils/date';

export default function MedicalRecordListScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const isFocused = useIsFocused();
  const isDoctor = user?.role === 'doctor';
  const isPatient = user?.role === 'patient';
  const [records, setRecords] = useState([]);
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        if (isDoctor) {
          const response = await api.get('/medical-records/doctor/patients', {
            params: {
              search: search.trim() || undefined,
            },
          });
          setPatients(response.data.data);
          return;
        }

        const response = await api.get('/medical-records');
        setRecords(response.data.data);
      } catch (error) {
        Alert.alert('Unable to load records', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (isFocused) {
      loadData();
    }
  }, [isDoctor, isFocused, search]);

  if (loading) {
    return <LoadingOverlay message={isDoctor ? 'Loading patient history...' : 'Loading medical records...'} />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: themeColors.text }]}>{isDoctor ? 'Medical History' : 'Medical Records'}</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
            {isDoctor
              ? 'Search patients you have seen before and open their previous notes, diagnoses, and clinical vitals.'
              : isPatient
                ? 'View your diagnosis summaries, treatment plans, clinical vitals, and uploaded attachments.'
                : 'Review saved medical records. Admins can view record details and delete records when necessary.'}
          </Text>
        </View>
      </View>

      {isDoctor ? (
        <>
          <AppInput
            label="Search patient"
            onChangeText={setSearch}
            placeholder="Type patient name, email, or phone"
            value={search}
          />

          {patients.length === 0 ? (
            <EmptyState
              message="No patient history matched your search yet."
              title="No patient history"
            />
          ) : (
            patients.map((patient) => (
              <EntityCard
                key={patient._id}
                meta={[
                  `Appointments with you: ${patient.appointmentCount || 0}`,
                  `Last visit: ${patient.lastAppointmentDate ? formatDateOnly(patient.lastAppointmentDate) : 'Not set'}`,
                  ...(patient.phone ? [`Phone: ${patient.phone}`] : []),
                ]}
                onPress={() =>
                  navigation.navigate('MedicalHistory', {
                    patientId: patient._id,
                    patientName: `${patient.firstName} ${patient.lastName}`,
                  })
                }
                status="active"
                subtitle={patient.email || 'Patient record'}
                title={`${patient.firstName} ${patient.lastName}`}
              />
            ))
          )}
        </>
      ) : records.length === 0 ? (
        <EmptyState
          message="No medical records are available yet."
          title="No records found"
        />
      ) : (
        records.map((record) => (
          <EntityCard
            key={record._id}
            meta={
              isPatient
                ? [
                    `Doctor: ${record.doctor?.firstName} ${record.doctor?.lastName}`,
                    `Visit date: ${record.appointment?.appointmentDate ? formatDateOnly(record.appointment.appointmentDate) : formatDateOnly(record.createdAt)}`,
                    `Attachments: ${record.attachments?.length || 0}`,
                  ]
                : [
                    `Patient: ${record.patient?.firstName} ${record.patient?.lastName}`,
                    `Doctor: ${record.doctor?.firstName} ${record.doctor?.lastName}`,
                    `Attachments: ${record.attachments?.length || 0}`,
                  ]
            }
            onPress={() =>
              navigation.navigate(
                isPatient ? 'PatientMedicalRecord' : 'MedicalRecordForm',
                { medicalRecord: record }
              )
            }
            status={record.isArchived ? 'archived' : 'active'}
            subtitle={isPatient ? record.doctor?.specialization || record.diagnosis : record.diagnosis}
            title={record.diagnosis}
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
