import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import api, { getFileBaseUrl } from '../api/client';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppSelect from '../components/AppSelect';
import EmptyState from '../components/EmptyState';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { getTodayDateKey, toDateKey } from '../utils/clinicSchedule';
import { formatDateTime, toPickerItems } from '../utils/date';

const buildVitalsState = (clinicalVitals = {}) => ({
  bloodPressure: clinicalVitals?.bloodPressure || '',
  heartRate:
    clinicalVitals?.heartRate === null || clinicalVitals?.heartRate === undefined ? '' : String(clinicalVitals.heartRate),
  respiratoryRate:
    clinicalVitals?.respiratoryRate === null || clinicalVitals?.respiratoryRate === undefined
      ? ''
      : String(clinicalVitals.respiratoryRate),
  temperatureCelsius:
    clinicalVitals?.temperatureCelsius === null || clinicalVitals?.temperatureCelsius === undefined
      ? ''
      : String(clinicalVitals.temperatureCelsius),
  oxygenSaturation:
    clinicalVitals?.oxygenSaturation === null || clinicalVitals?.oxygenSaturation === undefined
      ? ''
      : String(clinicalVitals.oxygenSaturation),
  weightKg:
    clinicalVitals?.weightKg === null || clinicalVitals?.weightKg === undefined ? '' : String(clinicalVitals.weightKg),
  heightCm:
    clinicalVitals?.heightCm === null || clinicalVitals?.heightCm === undefined ? '' : String(clinicalVitals.heightCm),
});

const parseOptionalNumber = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

const validateClinicalVitals = (vitals) => {
  const nextErrors = {};

  if (vitals.bloodPressure && !/^\d{2,3}\/\d{2,3}$/.test(vitals.bloodPressure.trim())) {
    nextErrors.bloodPressure = 'Use a format like 120/80';
  }

  const numericChecks = [
    ['heartRate', 'Heart rate', 1, 250],
    ['respiratoryRate', 'Respiratory rate', 1, 80],
    ['temperatureCelsius', 'Temperature', 30, 45],
    ['oxygenSaturation', 'Oxygen saturation', 1, 100],
    ['weightKg', 'Weight', 0.1, 400],
    ['heightCm', 'Height', 30, 300],
  ];

  numericChecks.forEach(([field, label, min, max]) => {
    const value = vitals[field];

    if (value === '' || value === null || value === undefined) {
      return;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      nextErrors[field] = `${label} must be a number`;
      return;
    }

    if (numericValue < min || numericValue > max) {
      nextErrors[field] = `${label} must be between ${min} and ${max}`;
    }
  });

  return nextErrors;
};

export default function MedicalRecordFormScreen({ navigation, route }) {
  const { colors: themeColors, isDark } = useTheme();
  const { user } = useAuth();
  const existingRecord = route.params?.medicalRecord || null;
  const linkedAppointment = route.params?.appointment || existingRecord?.appointment || null;
  const isDoctorStartMode = user?.role === 'doctor' && route.params?.startMode;
  const canEdit = ['doctor', 'admin'].includes(user?.role);
  const canStartToday = !linkedAppointment || toDateKey(linkedAppointment.appointmentDate) === getTodayDateKey();
  const isDoctorCompletedRecordView = user?.role === 'doctor' && existingRecord && !isDoctorStartMode;
  const canEditCurrentForm = canEdit && !isDoctorCompletedRecordView && (!isDoctorStartMode || canStartToday);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(canEdit && !isDoctorStartMode);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState('notes');
  const [vitalErrors, setVitalErrors] = useState({});
  const [form, setForm] = useState({
    patient: linkedAppointment?.patient?._id || existingRecord?.patient?._id || '',
    appointment: linkedAppointment?._id || existingRecord?.appointment?._id || '',
    diagnosis: existingRecord?.diagnosis || '',
    symptoms: existingRecord?.symptoms || '',
    treatmentPlan: existingRecord?.treatmentPlan || '',
    notes: existingRecord?.notes || '',
    doctor: linkedAppointment?.doctor?._id || existingRecord?.doctor?._id || '',
  });
  const [vitals, setVitals] = useState(buildVitalsState(existingRecord?.clinicalVitals));

  useEffect(() => {
    const loadOptions = async () => {
      if (!canEdit || isDoctorStartMode) {
        setLoading(false);
        return;
      }

      try {
        const [patientsResponse, doctorsResponse, appointmentsResponse] = await Promise.all([
          api.get('/users?role=patient'),
          api.get('/users?role=doctor'),
          api.get('/appointments'),
        ]);

        setPatients(patientsResponse.data.data);
        setDoctors(doctorsResponse.data.data);
        setAppointments(appointmentsResponse.data.data);
      } catch (error) {
        Alert.alert('Unable to load form data', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, [canEdit, isDoctorStartMode]);

  const appointmentSummary = useMemo(() => {
    if (!linkedAppointment) {
      return null;
    }

    return {
      patientName: `${linkedAppointment.patient?.firstName || ''} ${linkedAppointment.patient?.lastName || ''}`.trim(),
      tokenNumber: linkedAppointment.tokenNumber,
      session: linkedAppointment.appointmentSession,
      date: linkedAppointment.appointmentDate,
    };
  }, [linkedAppointment]);

  const handleSave = async () => {
    const targetPatient = isDoctorStartMode ? linkedAppointment?.patient?._id : form.patient;
    const targetDoctor = user?.role === 'doctor' ? user._id : form.doctor;
    const targetAppointment = isDoctorStartMode ? linkedAppointment?._id : form.appointment;

    if (!form.diagnosis || !targetPatient || (user?.role === 'admin' && !targetDoctor)) {
      Alert.alert('Missing fields', 'Please complete the diagnosis and required patient or doctor fields.');
      return;
    }

    if (isDoctorStartMode && !canStartToday) {
      Alert.alert('Not available', 'Doctors can only start appointments on the scheduled appointment day.');
      return;
    }

    const nextVitalErrors = validateClinicalVitals(vitals);
    setVitalErrors(nextVitalErrors);

    if (Object.keys(nextVitalErrors).length) {
      Alert.alert('Invalid vitals', 'Please correct the highlighted clinical values before saving.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        patient: targetPatient,
        appointment: targetAppointment || '',
        diagnosis: form.diagnosis,
        symptoms: form.symptoms,
        treatmentPlan: form.treatmentPlan,
        notes: form.notes,
        clinicalVitals: {
          bloodPressure: vitals.bloodPressure,
          heartRate: parseOptionalNumber(vitals.heartRate),
          respiratoryRate: parseOptionalNumber(vitals.respiratoryRate),
          temperatureCelsius: parseOptionalNumber(vitals.temperatureCelsius),
          oxygenSaturation: parseOptionalNumber(vitals.oxygenSaturation),
          weightKg: parseOptionalNumber(vitals.weightKg),
          heightCm: parseOptionalNumber(vitals.heightCm),
        },
      };

      if (targetDoctor) {
        payload.doctor = targetDoctor;
      }

      if (existingRecord?._id) {
        await api.put(`/medical-records/${existingRecord._id}`, payload);
      } else {
        await api.post('/medical-records', payload);
      }

      Alert.alert('Saved', isDoctorStartMode ? 'Appointment notes saved successfully.' : 'Medical record saved successfully.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Unable to save medical record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    try {
      await api.patch(`/medical-records/${existingRecord._id}/archive`);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Archive failed', error?.response?.data?.message || 'Unable to archive record.');
    }
  };

  const handleDelete = async () => {
    Alert.alert('Delete medical record', 'Are you sure you want to permanently delete this record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/medical-records/${existingRecord._id}`);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Delete failed', error?.response?.data?.message || 'Unable to delete record.');
          }
        },
      },
    ]);
  };

  const handleUploadAttachment = async () => {
    if (!existingRecord?._id) {
      Alert.alert('Save first', 'Save the record first, then upload supporting files.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const file = result.assets[0];
      const formData = new FormData();
      formData.append('attachments', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      });

      setUploading(true);
      await api.post(`/medical-records/${existingRecord._id}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Uploaded', 'Attachment uploaded successfully.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Upload failed', error?.response?.data?.message || 'Unable to upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      await api.delete(`/medical-records/${existingRecord._id}/attachments/${attachmentId}`);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Delete failed', error?.response?.data?.message || 'Unable to remove attachment.');
    }
  };

  if (loading) {
    return <LoadingOverlay message="Preparing medical record form..." />;
  }

  return (
    <ScreenContainer>
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          {isDoctorStartMode ? 'Start appointment' : existingRecord ? 'Completed appointment record' : 'Medical record'}
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          {isDoctorStartMode
            ? 'Add the medical record and optional clinical vitals. Saving this form finishes the appointment.'
            : isDoctorCompletedRecordView
            ? 'This appointment is finished. You can review the saved medical notes and vitals here.'
            : 'Clinical findings, treatment plans, and supporting documents.'}
        </Text>

        {appointmentSummary ? (
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
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Patient: {appointmentSummary.patientName}</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Date: {formatDateTime(appointmentSummary.date)}</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Session: {appointmentSummary.session || 'Not set'}</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Token: {appointmentSummary.tokenNumber || '-'}</Text>
            {!canStartToday && isDoctorStartMode ? (
              <Text style={[styles.summaryWarning, { color: themeColors.danger }]}>
                Doctors can only start appointments on the scheduled day.
              </Text>
            ) : null}
          </View>
        ) : null}

        {!isDoctorStartMode && !isDoctorCompletedRecordView ? (
          <>
            <AppSelect
              items={toPickerItems(patients, (patient) => `${patient.firstName} ${patient.lastName}`)}
              label="Patient"
              onValueChange={(patient) => setForm((current) => ({ ...current, patient }))}
              value={form.patient}
            />
            {user?.role === 'admin' ? (
              <AppSelect
                items={toPickerItems(doctors, (doctor) => `${doctor.firstName} ${doctor.lastName}`)}
                label="Doctor"
                onValueChange={(doctor) => setForm((current) => ({ ...current, doctor }))}
                value={form.doctor}
              />
            ) : null}
            <AppSelect
              items={[
                { label: 'No linked appointment', value: '' },
                ...toPickerItems(
                  appointments,
                  (appointment) =>
                    `${appointment.patient?.firstName || ''} ${appointment.patient?.lastName || ''} - ${new Date(appointment.appointmentDate).toLocaleDateString()}`
                ),
              ]}
              label="Appointment"
              onValueChange={(appointment) => setForm((current) => ({ ...current, appointment }))}
              value={form.appointment}
            />
          </>
        ) : null}

        <View style={styles.segmentRow}>
          <AppButton onPress={() => setActiveSection('notes')} title="Medical notes" variant={activeSection === 'notes' ? 'primary' : 'secondary'} />
          <AppButton onPress={() => setActiveSection('vitals')} title="Clinical vitals" variant={activeSection === 'vitals' ? 'primary' : 'secondary'} />
        </View>

        {activeSection === 'notes' ? (
          <>
            <AppInput
              editable={canEditCurrentForm}
              label="Diagnosis"
              onChangeText={(diagnosis) => setForm((current) => ({ ...current, diagnosis }))}
              value={form.diagnosis}
            />
            <AppInput
              editable={canEditCurrentForm}
              label="Medical notes"
              multiline
              onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
              value={form.notes}
            />
            <AppInput
              editable={canEditCurrentForm}
              label="Symptoms"
              multiline
              onChangeText={(symptoms) => setForm((current) => ({ ...current, symptoms }))}
              value={form.symptoms}
            />
            <AppInput
              editable={canEditCurrentForm}
              label="Treatment plan"
              multiline
              onChangeText={(treatmentPlan) => setForm((current) => ({ ...current, treatmentPlan }))}
              value={form.treatmentPlan}
            />
          </>
        ) : (
          <>
            <AppInput
              editable={canEditCurrentForm}
              error={vitalErrors.bloodPressure}
              label="Blood pressure"
              onChangeText={(bloodPressure) => setVitals((current) => ({ ...current, bloodPressure }))}
              placeholder="120/80"
              value={vitals.bloodPressure}
            />
            <AppInput
              editable={canEditCurrentForm}
              error={vitalErrors.heartRate}
              keyboardType="numeric"
              label="Heart rate"
              onChangeText={(heartRate) => setVitals((current) => ({ ...current, heartRate }))}
              placeholder="72"
              value={vitals.heartRate}
            />
            <AppInput
              editable={canEditCurrentForm}
              error={vitalErrors.respiratoryRate}
              keyboardType="numeric"
              label="Respiratory rate"
              onChangeText={(respiratoryRate) => setVitals((current) => ({ ...current, respiratoryRate }))}
              placeholder="16"
              value={vitals.respiratoryRate}
            />
            <AppInput
              editable={canEditCurrentForm}
              error={vitalErrors.temperatureCelsius}
              keyboardType="numeric"
              label="Temperature (C)"
              onChangeText={(temperatureCelsius) => setVitals((current) => ({ ...current, temperatureCelsius }))}
              placeholder="36.8"
              value={vitals.temperatureCelsius}
            />
            <AppInput
              editable={canEditCurrentForm}
              error={vitalErrors.oxygenSaturation}
              keyboardType="numeric"
              label="Oxygen saturation (%)"
              onChangeText={(oxygenSaturation) => setVitals((current) => ({ ...current, oxygenSaturation }))}
              placeholder="98"
              value={vitals.oxygenSaturation}
            />
            <AppInput
              editable={canEditCurrentForm}
              error={vitalErrors.weightKg}
              keyboardType="numeric"
              label="Weight (kg)"
              onChangeText={(weightKg) => setVitals((current) => ({ ...current, weightKg }))}
              placeholder="68"
              value={vitals.weightKg}
            />
            <AppInput
              editable={canEditCurrentForm}
              error={vitalErrors.heightCm}
              keyboardType="numeric"
              label="Height (cm)"
              onChangeText={(heightCm) => setVitals((current) => ({ ...current, heightCm }))}
              placeholder="172"
              value={vitals.heightCm}
            />
          </>
        )}

        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Attachments</Text>
        {existingRecord?.attachments?.length ? (
          existingRecord.attachments.map((attachment) => (
            <View key={attachment._id} style={[styles.attachmentRow, { backgroundColor: themeColors.surfaceMuted }]}>
              <View style={styles.attachmentText}>
                <Text style={[styles.attachmentName, { color: themeColors.text }]}>{attachment.originalName}</Text>
                <Text style={[styles.attachmentMeta, { color: themeColors.textMuted }]}>{attachment.mimeType}</Text>
              </View>
              <View style={styles.attachmentActions}>
                <AppButton
                  onPress={() => Linking.openURL(`${getFileBaseUrl()}/${attachment.url}`)}
                  title="Open"
                  variant="outline"
                />
                {canEditCurrentForm ? (
                  <AppButton
                    onPress={() => handleDeleteAttachment(attachment._id)}
                    title="Remove"
                    variant="danger"
                  />
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <EmptyState message="No attachments uploaded for this medical record yet." title="No files" />
        )}

        {canEditCurrentForm ? (
          <View style={styles.actions}>
            {existingRecord && canEditCurrentForm ? (
              <AppButton loading={uploading} onPress={handleUploadAttachment} title="Upload attachment" variant="secondary" />
            ) : null}
            {canEditCurrentForm ? <AppButton loading={submitting} onPress={handleSave} title={isDoctorStartMode ? 'Finish appointment' : 'Save medical record'} /> : null}
            {existingRecord && canEditCurrentForm && !isDoctorStartMode ? <AppButton onPress={handleArchive} title="Archive" variant="outline" /> : null}
            {existingRecord && canEditCurrentForm && !isDoctorStartMode ? <AppButton onPress={handleDelete} title="Delete" variant="danger" /> : null}
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
    lineHeight: 20,
  },
  summaryWarning: {
    color: colors.danger,
    fontWeight: '700',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  attachmentRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  attachmentText: {
    marginBottom: spacing.md,
  },
  attachmentName: {
    color: colors.text,
    fontWeight: '700',
  },
  attachmentMeta: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  attachmentActions: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
