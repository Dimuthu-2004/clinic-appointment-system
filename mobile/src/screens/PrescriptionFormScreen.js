import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import api from '../api/client';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import AppSelect from '../components/AppSelect';
import EmptyState from '../components/EmptyState';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';
import { openPrescriptionPdf } from '../utils/prescriptions';
import { formatCurrency, formatDateTime } from '../utils/date';

const createMedication = () => ({
  name: '',
  dosage: '',
  frequency: '',
  duration: '',
  instructions: '',
});

const getPersonName = (person) => `${person?.firstName || ''} ${person?.lastName || ''}`.trim();

export default function PrescriptionFormScreen({ navigation, route }) {
  const { colors: themeColors, isDark } = useTheme();
  const { user } = useAuth();
  const existingPrescription = route.params?.prescription || null;
  const canEdit = user?.role === 'doctor';
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [drugInventory, setDrugInventory] = useState([]);
  const [loading, setLoading] = useState(canEdit);
  const [submitting, setSubmitting] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState(null);
  const [patientQuery, setPatientQuery] = useState(getPersonName(existingPrescription?.patient));
  const [showPatientSuggestions, setShowPatientSuggestions] = useState(false);
  const [form, setForm] = useState({
    patient: existingPrescription?.patient?._id || '',
    appointment: existingPrescription?.appointment?._id || '',
    medications: existingPrescription?.medications?.length
      ? existingPrescription.medications.map((medication) => ({ ...medication }))
      : [createMedication()],
    notes: existingPrescription?.notes || '',
  });

  useEffect(() => {
    const loadOptions = async () => {
      if (!canEdit) {
        return;
      }

      try {
        const [patientsResponse, appointmentsResponse, drugsResponse] = await Promise.all([
          api.get('/users?role=patient'),
          api.get('/appointments'),
          api.get('/drugs'),
        ]);

        setPatients(patientsResponse.data.data || []);
        setAppointments(appointmentsResponse.data.data || []);
        setDrugInventory((drugsResponse.data.data || []).filter((drug) => drug.isActive));
      } catch (error) {
        Alert.alert('Unable to load prescription data', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, [canEdit]);

  const patientSuggestions = useMemo(() => {
    const normalizedQuery = patientQuery.trim().toLowerCase();

    if (!normalizedQuery || !canEdit) {
      return [];
    }

    return patients
      .filter((patient) => getPersonName(patient).toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [canEdit, patientQuery, patients]);

  const appointmentOptions = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.status !== 'cancelled' &&
            (!form.patient || appointment.patient?._id === form.patient)
        )
        .map((appointment) => ({
          label: `${getPersonName(appointment.patient)} - ${formatDateTime(appointment.appointmentDate)}`,
          value: appointment._id,
        })),
    [appointments, form.patient]
  );

  const selectPatient = (patient) => {
    setPatientQuery(getPersonName(patient));
    setShowPatientSuggestions(false);
    setForm((current) => ({
      ...current,
      patient: patient._id,
      appointment: '',
    }));
  };

  const updateMedication = (index, field, value) => {
    setForm((current) => ({
      ...current,
      medications: current.medications.map((medication, medicationIndex) =>
        medicationIndex === index ? { ...medication, [field]: value } : medication
      ),
    }));
  };

  const addMedication = () => {
    setForm((current) => ({
      ...current,
      medications: [...current.medications, createMedication()],
    }));
  };

  const removeMedication = (index) => {
    setForm((current) => ({
      ...current,
      medications: current.medications.filter((_, medicationIndex) => medicationIndex !== index),
    }));
  };

  const getDrugSuggestions = (query) => {
    const normalizedQuery = String(query || '').trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    return drugInventory
      .filter((drug) =>
        [drug.name, drug.genericName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery))
      )
      .slice(0, 6);
  };

  const handleSave = async () => {
    if (!form.patient) {
      Alert.alert('Missing patient', 'Please choose a patient from the suggestion list.');
      return;
    }

    if (
      form.medications.some(
        (medication) =>
          !medication.name.trim() ||
          !medication.dosage.trim() ||
          !medication.frequency.trim() ||
          !medication.duration.trim()
      )
    ) {
      Alert.alert('Missing fields', 'Please complete each drug name, dosage, frequency, and duration.');
      return;
    }

    const invalidDosage = form.medications.find((medication) => {
      const dosageValue = Number(medication.dosage);
      return !Number.isFinite(dosageValue) || dosageValue <= 0;
    });

    if (invalidDosage) {
      Alert.alert('Invalid dosage', 'Each dosage must be a positive value greater than 0.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        patient: form.patient,
        appointment: form.appointment || '',
        medications: form.medications.map((medication) => ({
          name: medication.name.trim(),
          dosage: medication.dosage.trim(),
          frequency: medication.frequency.trim(),
          duration: medication.duration.trim(),
          instructions: medication.instructions.trim(),
        })),
        notes: form.notes.trim(),
      };

      if (existingPrescription?._id) {
        await api.put(`/prescriptions/${existingPrescription._id}`, payload);
      } else {
        await api.post('/prescriptions', payload);
      }

      Alert.alert('Saved', 'Prescription saved successfully.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Unable to save prescription.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert('Delete prescription', 'Are you sure you want to delete this prescription?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/prescriptions/${existingPrescription._id}`);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Delete failed', error?.response?.data?.message || 'Unable to delete prescription.');
          }
        },
      },
    ]);
  };

  const handleCheckAvailability = async () => {
    if (!existingPrescription?._id) {
      return;
    }

    try {
      setAvailabilityLoading(true);
      const response = await api.get(`/prescriptions/${existingPrescription._id}/availability`);
      setAvailabilityResult(response.data.data);
    } catch (error) {
      Alert.alert('Unable to check availability', error?.response?.data?.message || 'Try again later.');
    } finally {
      setAvailabilityLoading(false);
    }
  };

  if (loading) {
    return <LoadingOverlay message="Preparing prescription form..." />;
  }

  return (
    <ScreenContainer>
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          {canEdit ? 'Digital prescription' : 'Prescription details'}
        </Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          {canEdit
            ? 'Choose the patient, add the required medicines, and save the prescription.'
            : 'Review the prescribed medicines and check current pharmacy availability.'}
        </Text>

        {existingPrescription ? (
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: isDark ? themeColors.surfaceMuted : '#F4FBFA', borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.summaryTitle, { color: themeColors.primaryDark }]}>Prescription summary</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Patient: {getPersonName(existingPrescription.patient)}</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Doctor: Dr {getPersonName(existingPrescription.doctor)}</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>
              Appointment: {existingPrescription.appointment?.appointmentDate ? formatDateTime(existingPrescription.appointment.appointmentDate) : 'Not linked'}
            </Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Session: {existingPrescription.appointment?.appointmentSession || 'Not set'}</Text>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>Token: {existingPrescription.appointment?.tokenNumber || '-'}</Text>
          </View>
        ) : null}

        {canEdit ? (
          <>
            <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Patient</Text>
            <AppInput
              label="Search patient"
              onChangeText={(value) => {
                setPatientQuery(value);
                setShowPatientSuggestions(true);
                setForm((current) => ({ ...current, patient: '', appointment: '' }));
              }}
              placeholder="Start typing the patient name"
              value={patientQuery}
            />
            {showPatientSuggestions && patientSuggestions.length ? (
              <View style={[styles.suggestionsCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                {patientSuggestions.map((patient) => (
                  <Pressable
                    key={patient._id}
                    onPress={() => selectPatient(patient)}
                    style={[styles.suggestionRow, { borderBottomColor: themeColors.border }]}
                  >
                    <Text style={[styles.suggestionTitle, { color: themeColors.text }]}>{getPersonName(patient)}</Text>
                    <Text style={[styles.suggestionMeta, { color: themeColors.textMuted }]}>{patient.email}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <AppSelect
              items={[{ label: 'No linked appointment', value: '' }, ...appointmentOptions]}
              label="Appointment (optional)"
              onValueChange={(appointment) => setForm((current) => ({ ...current, appointment }))}
              value={form.appointment}
            />
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Medicines</Text>
        {form.medications.map((medication, index) => {
          const drugSuggestions = canEdit ? getDrugSuggestions(medication.name) : [];

          return (
            <View key={`medication-${index}`} style={[styles.medicationCard, { backgroundColor: themeColors.surfaceMuted }]}>
              <Text style={[styles.medicationTitle, { color: themeColors.text }]}>Drug {index + 1}</Text>

              {canEdit ? (
                <>
                  <AppInput
                    label="Drug name"
                    onChangeText={(value) => updateMedication(index, 'name', value)}
                    placeholder="Start typing the drug name"
                    value={medication.name}
                  />
                  {drugSuggestions.length ? (
                    <View style={[styles.suggestionsCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
                      {drugSuggestions.map((drug) => (
                        <Pressable
                          key={`${index}-${drug._id}`}
                          onPress={() => updateMedication(index, 'name', drug.name)}
                          style={[styles.suggestionRow, { borderBottomColor: themeColors.border }]}
                        >
                          <Text style={[styles.suggestionTitle, { color: themeColors.text }]}>{drug.name}</Text>
                          <Text style={[styles.suggestionMeta, { color: themeColors.textMuted }]}>
                            {drug.genericName || 'Clinic stock item'} | {formatCurrency(drug.unitPrice, 'LKR')}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  <AppInput
                    label="Dosage"
                    keyboardType="numeric"
                    onChangeText={(value) => updateMedication(index, 'dosage', value)}
                    placeholder="Example: 1"
                    value={medication.dosage}
                  />
                  <AppInput
                    label="Frequency"
                    onChangeText={(value) => updateMedication(index, 'frequency', value)}
                    value={medication.frequency}
                  />
                  <AppInput
                    label="Duration"
                    onChangeText={(value) => updateMedication(index, 'duration', value)}
                    value={medication.duration}
                  />
                  <AppInput
                    label="Instructions"
                    multiline
                    onChangeText={(value) => updateMedication(index, 'instructions', value)}
                    value={medication.instructions}
                  />
                  {form.medications.length > 1 ? (
                    <Pressable onPress={() => removeMedication(index)}>
                      <Text style={styles.removeText}>Remove drug</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <>
                  <DetailRow label="Drug" value={medication.name} />
                  <DetailRow label="Dosage" value={medication.dosage} />
                  <DetailRow label="Frequency" value={medication.frequency} />
                  <DetailRow label="Duration" value={medication.duration} />
                  <DetailRow label="Instructions" value={medication.instructions || 'No extra instructions'} />
                </>
              )}
            </View>
          );
        })}

        {canEdit ? <AppButton onPress={addMedication} title="Add another drug" variant="secondary" /> : null}

        {canEdit ? (
          <AppInput
            label="Notes"
            multiline
            onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
            value={form.notes}
          />
        ) : form.notes ? (
          <View
            style={[
              styles.notesCard,
              { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FCFB', borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.notesTitle, { color: themeColors.text }]}>Notes</Text>
            <Text style={[styles.notesText, { color: themeColors.text }]}>{form.notes}</Text>
          </View>
        ) : null}

        {canEdit ? (
          <View style={styles.actions}>
            <AppButton loading={submitting} onPress={handleSave} title="Save prescription" />
            {existingPrescription ? <AppButton onPress={handleDelete} title="Delete" variant="danger" /> : null}
          </View>
        ) : existingPrescription ? (
          <View style={styles.actions}>
            <AppButton loading={availabilityLoading} onPress={handleCheckAvailability} title="Check availability" />
            <AppButton
              onPress={() => openPrescriptionPdf(existingPrescription._id)}
              title="Download prescription PDF"
              variant="secondary"
            />
          </View>
        ) : null}

        {!canEdit && availabilityResult ? (
          <View style={styles.availabilityCard}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Available in pharmacy</Text>
            {availabilityResult.matches.every((item) => !item.matches.length) ? (
              <EmptyState message="None of the prescribed drugs are currently available in stock." title="No stock matches" />
            ) : (
              availabilityResult.matches.map((item) => (
                <View
                  key={item.medicationName}
                  style={[
                    styles.availabilityGroup,
                    { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FCFB', borderColor: themeColors.border },
                  ]}
                >
                  <Text style={[styles.availabilityTitle, { color: themeColors.primaryDark }]}>
                    {item.medicationName}
                  </Text>
                  {item.matches.length ? (
                    item.matches.map((drug) => (
                      <View key={drug._id} style={styles.availabilityRow}>
                        <View>
                          <Text style={[styles.suggestionTitle, { color: themeColors.text }]}>{drug.name}</Text>
                          <Text style={[styles.suggestionMeta, { color: themeColors.textMuted }]}>
                            {drug.genericName || 'Clinic stock'} | Qty {drug.quantityInStock}
                          </Text>
                        </View>
                        <Text style={[styles.priceText, { color: themeColors.primaryDark }]}>
                          {formatCurrency(drug.unitPrice, 'LKR')}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.noMatchText, { color: themeColors.textMuted }]}>
                      No stocked match found for this drug.
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function DetailRow({ label, value }) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: themeColors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: themeColors.text }]}>{value}</Text>
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
  fieldLabel: {
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  summaryCard: {
    backgroundColor: '#F4FBFA',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    color: colors.primaryDark,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  summaryText: {
    color: colors.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  medicationCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  medicationTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  suggestionsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  suggestionMeta: {
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 18,
  },
  removeText: {
    color: colors.danger,
    fontWeight: '700',
  },
  detailRow: {
    marginBottom: spacing.sm,
  },
  detailLabel: {
    color: colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    color: colors.text,
    fontWeight: '700',
    lineHeight: 20,
  },
  notesCard: {
    backgroundColor: '#F8FCFB',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  notesTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  notesText: {
    color: colors.text,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  availabilityCard: {
    marginTop: spacing.lg,
  },
  availabilityGroup: {
    backgroundColor: '#F8FCFB',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  availabilityTitle: {
    color: colors.primaryDark,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  priceText: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
  noMatchText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
});
