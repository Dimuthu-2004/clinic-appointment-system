import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppButton from '../components/AppButton';
import EmptyState from '../components/EmptyState';
import ScreenContainer from '../components/ScreenContainer';
import { colors, radii, spacing, useTheme } from '../theme';
import { getFileBaseUrl } from '../api/client';
import { formatDateOnly, formatDateTime } from '../utils/date';

const formatVitals = (clinicalVitals = {}) => {
  const fields = [
    ['Blood pressure', clinicalVitals.bloodPressure || 'Not recorded'],
    [
      'Heart rate',
      clinicalVitals.heartRate === null || clinicalVitals.heartRate === undefined
        ? 'Not recorded'
        : `${clinicalVitals.heartRate} bpm`,
    ],
    [
      'Respiratory rate',
      clinicalVitals.respiratoryRate === null || clinicalVitals.respiratoryRate === undefined
        ? 'Not recorded'
        : `${clinicalVitals.respiratoryRate} breaths/min`,
    ],
    [
      'Temperature',
      clinicalVitals.temperatureCelsius === null || clinicalVitals.temperatureCelsius === undefined
        ? 'Not recorded'
        : `${Number(clinicalVitals.temperatureCelsius).toFixed(1)} C`,
    ],
    [
      'Oxygen saturation',
      clinicalVitals.oxygenSaturation === null || clinicalVitals.oxygenSaturation === undefined
        ? 'Not recorded'
        : `${clinicalVitals.oxygenSaturation}%`,
    ],
    [
      'Weight',
      clinicalVitals.weightKg === null || clinicalVitals.weightKg === undefined
        ? 'Not recorded'
        : `${clinicalVitals.weightKg} kg`,
    ],
    [
      'Height',
      clinicalVitals.heightCm === null || clinicalVitals.heightCm === undefined
        ? 'Not recorded'
        : `${clinicalVitals.heightCm} cm`,
    ],
  ];

  return fields;
};

export default function PatientMedicalRecordScreen({ route }) {
  const { colors: themeColors, isDark } = useTheme();
  const medicalRecord = route.params?.medicalRecord || null;

  if (!medicalRecord) {
    return (
      <ScreenContainer>
        <EmptyState title="Record unavailable" message="This medical record could not be loaded." />
      </ScreenContainer>
    );
  }

  const doctorName = `${medicalRecord.doctor?.firstName || ''} ${medicalRecord.doctor?.lastName || ''}`.trim() || 'Doctor not set';
  const vitals = formatVitals(medicalRecord.clinicalVitals);

  return (
    <ScreenContainer>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: isDark ? '#123844' : '#E6FFFB',
              borderColor: isDark ? themeColors.border : '#BFECE8',
            },
          ]}
        >
          <Text style={[styles.heroLabel, { color: themeColors.primaryDark }]}>Patient record</Text>
          <Text style={[styles.heroTitle, { color: themeColors.text }]}>{medicalRecord.diagnosis || 'Medical record'}</Text>
          <Text style={[styles.heroMeta, { color: themeColors.textMuted }]}>
            Doctor: {doctorName === 'Doctor not set' ? doctorName : `Dr ${doctorName}`}
          </Text>
          <Text style={[styles.heroMeta, { color: themeColors.textMuted }]}>
            Created: {formatDateTime(medicalRecord.createdAt)}
          </Text>
          <Text style={[styles.heroMeta, { color: themeColors.textMuted }]}>
            Status: {medicalRecord.isArchived ? 'Archived' : 'Active'}
          </Text>
        </View>

        <SectionCard title="Appointment" themeColors={themeColors}>
          <DetailRow label="Date" value={medicalRecord.appointment?.appointmentDate ? formatDateTime(medicalRecord.appointment.appointmentDate) : 'Not linked'} />
          <DetailRow label="Session" value={medicalRecord.appointment?.appointmentSession || 'Not set'} />
          <DetailRow label="Token number" value={medicalRecord.appointment?.tokenNumber ? String(medicalRecord.appointment.tokenNumber) : 'Not assigned'} />
          <DetailRow label="Reason" value={medicalRecord.appointment?.reason || 'Clinic appointment'} />
        </SectionCard>

        <SectionCard title="Clinical Summary" themeColors={themeColors}>
          <Text style={[styles.sectionBody, { color: themeColors.textMuted }]}>
            {medicalRecord.notes || 'No additional medical notes were recorded for this visit.'}
          </Text>
        </SectionCard>

        <SectionCard title="Symptoms" themeColors={themeColors}>
          <Text style={[styles.sectionBody, { color: themeColors.textMuted }]}>
            {medicalRecord.symptoms || 'No symptoms were recorded.'}
          </Text>
        </SectionCard>

        <SectionCard title="Treatment Plan" themeColors={themeColors}>
          <Text style={[styles.sectionBody, { color: themeColors.textMuted }]}>
            {medicalRecord.treatmentPlan || 'No treatment plan was recorded.'}
          </Text>
        </SectionCard>

        <SectionCard title="Clinical Vitals" themeColors={themeColors}>
          {vitals.map(([label, value]) => (
            <DetailRow key={label} label={label} value={value} />
          ))}
        </SectionCard>

        <SectionCard title="Attachments" themeColors={themeColors}>
          {medicalRecord.attachments?.length ? (
            medicalRecord.attachments.map((attachment) => (
              <View key={attachment._id} style={[styles.attachmentCard, { backgroundColor: themeColors.surfaceMuted, borderColor: themeColors.border }]}>
                <Text style={[styles.attachmentName, { color: themeColors.text }]}>{attachment.originalName}</Text>
                <Text style={[styles.attachmentMeta, { color: themeColors.textMuted }]}>
                  {attachment.mimeType || 'File'}{attachment.uploadedAt ? ` | ${formatDateOnly(attachment.uploadedAt)}` : ''}
                </Text>
                <AppButton
                  onPress={() => Linking.openURL(`${getFileBaseUrl()}/${attachment.url}`)}
                  title="Open attachment"
                  variant="outline"
                />
              </View>
            ))
          ) : (
            <EmptyState title="No attachments" message="No files were added to this medical record." />
          )}
        </SectionCard>
      </ScrollView>
    </ScreenContainer>
  );
}

function SectionCard({ title, children, themeColors }) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.detailRow, { borderBottomColor: themeColors.border }]}>
      <Text style={[styles.detailLabel, { color: themeColors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: themeColors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  heroLabel: {
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  heroMeta: {
    lineHeight: 20,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  sectionBody: {
    lineHeight: 22,
  },
  detailRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  detailLabel: {
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  detailValue: {
    fontWeight: '600',
    lineHeight: 21,
  },
  attachmentCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  attachmentName: {
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  attachmentMeta: {
    lineHeight: 20,
    marginBottom: spacing.md,
  },
});
