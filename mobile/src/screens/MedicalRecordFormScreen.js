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
import { getDoctorStartState } from '../utils/appointmentRules';
import { formatDateTime, toPickerItems } from '../utils/date';

const splitBloodPressure = (bloodPressure = '') => {
  const match = String(bloodPressure || '').trim().match(/^(\d{2,3})\/(\d{2,3})$/);

  return {
    bloodPressureSystolic: match?.[1] || '',
    bloodPressureDiastolic: match?.[2] || '',
  };
};

const buildVitalsState = (clinicalVitals = {}) => ({
  ...splitBloodPressure(clinicalVitals?.bloodPressure),
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

const buildBloodPressureValue = (vitals) => {
  const systolic = String(vitals.bloodPressureSystolic || '').trim();
  const diastolic = String(vitals.bloodPressureDiastolic || '').trim();

  if (!systolic && !diastolic) {
    return '';
  }

  return `${systolic}/${diastolic}`;
};

const validateClinicalVitals = (vitals) => {
  const nextErrors = {};

  const systolic = String(vitals.bloodPressureSystolic || '').trim();
  const diastolic = String(vitals.bloodPressureDiastolic || '').trim();

  if ((systolic && !diastolic) || (!systolic && diastolic)) {
    nextErrors.bloodPressure = 'Enter both systolic and diastolic values';
  }

  if (systolic && diastolic) {
    const systolicValue = Number(systolic);
    const diastolicValue = Number(diastolic);

    if (!Number.isFinite(systolicValue) || systolicValue < 30 || systolicValue > 300) {
      nextErrors.bloodPressure = 'Systolic pressure must be between 30 and 300';
    } else if (!Number.isFinite(diastolicValue) || diastolicValue < 20 || diastolicValue > 200) {
      nextErrors.bloodPressure = 'Diastolic pressure must be between 20 and 200';
    }
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

const medicalRecordAttachmentTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function MedicalRecordFormScreen({ navigation, route }) {
  const { colors: themeColors, isDark } = useTheme();
  const { user } = useAuth();
  const existingRecord = route.params?.medicalRecord || null;
  const linkedAppointment = route.params?.appointment || existingRecord?.appointment || null;
  const isDoctorStartMode = user?.role === 'doctor' && route.params?.startMode;
  const isDoctor = user?.role === 'doctor';
  const isAdmin = user?.role === 'admin';
  const doctorStartState = linkedAppointment ? getDoctorStartState(linkedAppointment) : { canStart: true, reason: '' };
  const canStartToday = doctorStartState.canStart;
  const canEditCurrentForm = isDoctor && (!isDoctorStartMode || canStartToday);
  const canDeleteRecord = Boolean(existingRecord?._id) && (isDoctor || isAdmin) && !isDoctorStartMode;
  const canManageAttachments = isDoctor && canEditCurrentForm;
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(canEditCurrentForm && !isDoctorStartMode);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState('notes');
  const [vitalErrors, setVitalErrors] = useState({});
  const [attachments, setAttachments] = useState(existingRecord?.attachments || []);
  const [pendingAttachments, setPendingAttachments] = useState([]);
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
      if (!canEditCurrentForm || isDoctorStartMode) {
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
  }, [canEditCurrentForm, isDoctorStartMode]);

  useEffect(() => {
    setAttachments(existingRecord?.attachments || []);
  }, [existingRecord?._id]);

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

  const uploadSelectedAttachments = async (recordId, files) => {
    if (!recordId || !files.length) {
      return null;
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('attachments', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      });
    });

    const response = await api.post(`/medical-records/${recordId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data;
  };

  const handleSave = async () => {
    const targetPatient = isDoctorStartMode ? linkedAppointment?.patient?._id : form.patient;
    const targetDoctor = user?.role === 'doctor' ? user._id : form.doctor;
    const targetAppointment = isDoctorStartMode ? linkedAppointment?._id : form.appointment;

    if (!form.diagnosis || !targetPatient || (user?.role === 'admin' && !targetDoctor)) {
      Alert.alert('Missing fields', 'Please complete the diagnosis and required patient or doctor fields.');
      return;
    }

    if (isDoctorStartMode && !canStartToday) {
      Alert.alert('Not available', doctorStartState.reason);
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
          bloodPressure: buildBloodPressureValue(vitals),
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

      const response = existingRecord?._id
        ? await api.put(`/medical-records/${existingRecord._id}`, payload)
        : await api.post('/medical-records', payload);

      const savedRecord = response.data?.data;
      const savedRecordId = savedRecord?._id || existingRecord?._id;

      if (pendingAttachments.length && savedRecordId) {
        try {
          const updatedRecord = await uploadSelectedAttachments(savedRecordId, pendingAttachments);
          setAttachments(updatedRecord?.attachments || savedRecord?.attachments || []);
          setPendingAttachments([]);
        } catch (uploadError) {
          Alert.alert(
            'Saved with file issue',
            uploadError?.response?.data?.message || 'The record was saved, but attachment upload failed.'
          );
          navigation.goBack();
          return;
        }
      }

      Alert.alert(
        'Saved',
        pendingAttachments.length
          ? 'Medical record saved and selected files were added.'
          : isDoctorStartMode
            ? 'Appointment notes saved successfully.'
            : 'Medical record saved successfully.'
      );
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

  const handlePickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: medicalRecordAttachmentTypes,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      if (existingRecord?._id) {
        setUploading(true);
        const updatedRecord = await uploadSelectedAttachments(existingRecord._id, result.assets);
        setAttachments(updatedRecord?.attachments || []);
        Alert.alert(
          'Uploaded',
          'Attachment uploaded successfully.'
        );
        return;
      }

      setPendingAttachments((current) => [...current, ...result.assets]);
    } catch (error) {
      Alert.alert('Upload failed', error?.response?.data?.message || 'Unable to upload attachment.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePendingAttachment = (uri) => {
    setPendingAttachments((current) => current.filter((file) => file.uri !== uri));
  };

  const handleDeleteAttachment = async (attachmentId) => {
    try {
      const response = await api.delete(`/medical-records/${existingRecord._id}/attachments/${attachmentId}`);
      setAttachments(response.data?.data?.attachments || []);
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
          {isDoctorStartMode ? 'Start appointment' : existingRecord ? 'Medical record' : 'Medical record'}
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          {isDoctorStartMode
            ? 'Add the medical record and optional clinical vitals. Saving this form finishes the appointment.'
            : isAdmin
            ? 'Review the saved medical notes, attachments, and vitals. Admins can delete records but cannot edit them.'
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
                {doctorStartState.reason}
              </Text>
            ) : null}
          </View>
        ) : null}

        {canEditCurrentForm && !isDoctorStartMode ? (
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
              autoCapitalize="sentences"
              editable={canEditCurrentForm}
              label="Diagnosis"
              onChangeText={(diagnosis) => setForm((current) => ({ ...current, diagnosis }))}
              value={form.diagnosis}
            />
            <AppInput
              autoCapitalize="sentences"
              editable={canEditCurrentForm}
              label="Medical notes"
              multiline
              onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
              value={form.notes}
            />
            <AppInput
              autoCapitalize="sentences"
              editable={canEditCurrentForm}
              label="Symptoms"
              multiline
              onChangeText={(symptoms) => setForm((current) => ({ ...current, symptoms }))}
              value={form.symptoms}
            />
            <AppInput
              autoCapitalize="sentences"
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
              autoCapitalize="none"
              autoCorrect={false}
              editable={canEditCurrentForm}
              error={vitalErrors.bloodPressure}
              keyboardType="number-pad"
              label="Blood pressure systolic"
              onChangeText={(bloodPressureSystolic) => setVitals((current) => ({ ...current, bloodPressureSystolic }))}
              placeholder="120"
              value={vitals.bloodPressureSystolic}
            />
            <AppInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={canEditCurrentForm}
              error={vitalErrors.bloodPressure}
              keyboardType="number-pad"
              label="Blood pressure diastolic"
              onChangeText={(bloodPressureDiastolic) => setVitals((current) => ({ ...current, bloodPressureDiastolic }))}
              placeholder="80"
              value={vitals.bloodPressureDiastolic}
            />
            <AppInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={canEditCurrentForm}
              error={vitalErrors.heartRate}
              keyboardType="number-pad"
              label="Heart rate"
              onChangeText={(heartRate) => setVitals((current) => ({ ...current, heartRate }))}
              placeholder="72"
              value={vitals.heartRate}
            />
            <AppInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={canEditCurrentForm}
              error={vitalErrors.respiratoryRate}
              keyboardType="number-pad"
              label="Respiratory rate"
              onChangeText={(respiratoryRate) => setVitals((current) => ({ ...current, respiratoryRate }))}
              placeholder="16"
              value={vitals.respiratoryRate}
            />
            <AppInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={canEditCurrentForm}
              error={vitalErrors.temperatureCelsius}
              keyboardType="decimal-pad"
              label="Temperature (C)"
              onChangeText={(temperatureCelsius) => setVitals((current) => ({ ...current, temperatureCelsius }))}
              placeholder="36.8"
              value={vitals.temperatureCelsius}
            />
            <AppInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={canEditCurrentForm}
              error={vitalErrors.oxygenSaturation}
              keyboardType="number-pad"
              label="Oxygen saturation (%)"
              onChangeText={(oxygenSaturation) => setVitals((current) => ({ ...current, oxygenSaturation }))}
              placeholder="98"
              value={vitals.oxygenSaturation}
            />
            <AppInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={canEditCurrentForm}
              error={vitalErrors.weightKg}
              keyboardType="decimal-pad"
              label="Weight (kg)"
              onChangeText={(weightKg) => setVitals((current) => ({ ...current, weightKg }))}
              placeholder="68"
              value={vitals.weightKg}
            />
            <AppInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={canEditCurrentForm}
              error={vitalErrors.heightCm}
              keyboardType="number-pad"
              label="Height (cm)"
              onChangeText={(heightCm) => setVitals((current) => ({ ...current, heightCm }))}
              placeholder="172"
              value={vitals.heightCm}
            />
          </>
        )}

        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Attachments</Text>
        {attachments.length ? (
          attachments.map((attachment) => (
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
                {canManageAttachments ? (
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

        {canManageAttachments && pendingAttachments.length ? (
          <View style={styles.pendingAttachments}>
            <Text style={[styles.pendingTitle, { color: themeColors.text }]}>Selected from this device</Text>
            {pendingAttachments.map((file) => (
              <View
                key={file.uri}
                style={[styles.pendingAttachmentRow, { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.border }]}
              >
                <View style={styles.attachmentText}>
                  <Text style={[styles.attachmentName, { color: themeColors.text }]}>{file.name}</Text>
                  <Text style={[styles.attachmentMeta, { color: themeColors.textMuted }]}>
                    {file.mimeType || 'File'} | Uploads when you save
                  </Text>
                </View>
                <AppButton onPress={() => handleRemovePendingAttachment(file.uri)} title="Remove" variant="outline" />
              </View>
            ))}
          </View>
        ) : null}

        {canEditCurrentForm || canDeleteRecord ? (
          <View style={styles.actions}>
            {canManageAttachments ? (
              <AppButton
                loading={uploading}
                onPress={handlePickAttachment}
                title={existingRecord ? 'Add files from device' : 'Choose files from device'}
                variant="secondary"
              />
            ) : null}
            {canEditCurrentForm ? <AppButton loading={submitting} onPress={handleSave} title={isDoctorStartMode ? 'Finish appointment' : 'Save medical record'} /> : null}
            {existingRecord && canEditCurrentForm && !isDoctorStartMode ? <AppButton onPress={handleArchive} title="Archive" variant="outline" /> : null}
            {canDeleteRecord ? <AppButton onPress={handleDelete} title="Delete" variant="danger" /> : null}
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
  pendingAttachments: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  pendingTitle: {
    fontWeight: '700',
  },
  pendingAttachmentRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
