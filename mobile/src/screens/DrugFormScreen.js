import { useState } from 'react';
import { Alert, Image, StyleSheet, Switch, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import api, { getFileBaseUrl } from '../api/client';
import AppButton from '../components/AppButton';
import AppInput from '../components/AppInput';
import DateTimeField from '../components/DateTimeField';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';

export default function DrugFormScreen({ navigation, route }) {
  const { user } = useAuth();
  const { colors: themeColors, isDark } = useTheme();
  const existingDrug = route.params?.drug || null;
  const canEdit = user?.role === 'pharmacist';
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState({});
  const [imageUrl, setImageUrl] = useState(existingDrug?.imageUrl || '');
  const [form, setForm] = useState({
    name: existingDrug?.name || '',
    genericName: existingDrug?.genericName || '',
    category: existingDrug?.category || '',
    dosageForm: existingDrug?.dosageForm || '',
    strength: existingDrug?.strength || '',
    manufacturer: existingDrug?.manufacturer || '',
    batchNumber: existingDrug?.batchNumber || '',
    quantityInStock: existingDrug?.quantityInStock !== undefined ? String(existingDrug.quantityInStock) : '',
    reorderLevel: existingDrug?.reorderLevel !== undefined ? String(existingDrug.reorderLevel) : '0',
    unitPrice: existingDrug?.unitPrice !== undefined ? String(existingDrug.unitPrice) : '',
    expiryDate: existingDrug?.expiryDate || new Date().toISOString(),
    description: existingDrug?.description || '',
    isActive: existingDrug?.isActive ?? true,
  });

  const handleSave = async () => {
    const nextErrors = {};
    const quantityInStock = Number(form.quantityInStock);
    const reorderLevel = Number(form.reorderLevel || 0);
    const unitPrice = Number(form.unitPrice);
    const expiryDate = new Date(form.expiryDate);

    if (!form.name || form.quantityInStock === '' || form.unitPrice === '' || !form.expiryDate) {
      Alert.alert('Missing fields', 'Please complete the name, stock, price, and expiry date fields.');
      return;
    }

    if (!Number.isFinite(quantityInStock) || quantityInStock < 0) {
      nextErrors.quantityInStock = 'Stock quantity must be 0 or more';
    }

    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
      nextErrors.reorderLevel = 'Reorder level must be 0 or more';
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      nextErrors.unitPrice = 'Price must be greater than 0';
    }

    if (Number.isNaN(expiryDate.getTime())) {
      nextErrors.expiryDate = 'Choose a valid expiry date';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      Alert.alert('Invalid values', 'Please correct the highlighted pharmacy fields before saving.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        ...form,
        quantityInStock,
        reorderLevel,
        unitPrice,
        imageUrl,
      };

      if (existingDrug?._id) {
        await api.put(`/drugs/${existingDrug._id}`, payload);
      } else {
        await api.post('/drugs', payload);
      }

      Alert.alert('Saved', 'Drug item saved successfully.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Save failed', error?.response?.data?.message || 'Unable to save drug item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadImage = async () => {
    if (!existingDrug?._id) {
      Alert.alert('Save first', 'Save the drug first, then upload an optional photo.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: ['image/jpeg', 'image/png', 'image/webp'],
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const file = result.assets[0];
      const formData = new FormData();
      formData.append('image', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'image/jpeg',
      });

      setUploadingImage(true);
      const response = await api.post(`/drugs/${existingDrug._id}/image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImageUrl(response.data.data.imageUrl || '');
      Alert.alert('Uploaded', 'Drug photo uploaded successfully.');
    } catch (error) {
      Alert.alert('Upload failed', error?.response?.data?.message || 'Unable to upload drug photo.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert('Delete drug item', 'Are you sure you want to remove this drug item?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/drugs/${existingDrug._id}`);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Delete failed', error?.response?.data?.message || 'Unable to delete drug item.');
          }
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Drug details</Text>
        <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
          Manage the drug name, price, stock, out-of-stock state, optional photo, and other pharmacy details.
        </Text>

        <AppInput editable={canEdit} label="Drug name" onChangeText={(name) => setForm((current) => ({ ...current, name }))} value={form.name} />
        <AppInput editable={canEdit} label="Generic name" onChangeText={(genericName) => setForm((current) => ({ ...current, genericName }))} value={form.genericName} />
        <AppInput editable={canEdit} label="Category" onChangeText={(category) => setForm((current) => ({ ...current, category }))} value={form.category} />
        <AppInput editable={canEdit} label="Dosage form" onChangeText={(dosageForm) => setForm((current) => ({ ...current, dosageForm }))} value={form.dosageForm} />
        <AppInput editable={canEdit} label="Strength" onChangeText={(strength) => setForm((current) => ({ ...current, strength }))} value={form.strength} />
        <AppInput editable={canEdit} label="Manufacturer" onChangeText={(manufacturer) => setForm((current) => ({ ...current, manufacturer }))} value={form.manufacturer} />
        <AppInput editable={canEdit} label="Batch number" onChangeText={(batchNumber) => setForm((current) => ({ ...current, batchNumber }))} value={form.batchNumber} />
        <AppInput editable={canEdit} error={errors.quantityInStock} keyboardType="numeric" label="Stock quantity" onChangeText={(quantityInStock) => setForm((current) => ({ ...current, quantityInStock }))} value={form.quantityInStock} />
        <AppInput editable={canEdit} error={errors.reorderLevel} keyboardType="numeric" label="Reorder level" onChangeText={(reorderLevel) => setForm((current) => ({ ...current, reorderLevel }))} value={form.reorderLevel} />
        <Text style={[styles.helperText, { color: themeColors.textMuted }]}>Reorder level is the stock count where the pharmacy should restock this item.</Text>
        <AppInput editable={canEdit} error={errors.unitPrice} keyboardType="numeric" label="Price (LKR)" onChangeText={(unitPrice) => setForm((current) => ({ ...current, unitPrice }))} value={form.unitPrice} />
        <DateTimeField label="Expiry date" mode="date" onChange={(expiryDate) => setForm((current) => ({ ...current, expiryDate }))} value={form.expiryDate} />
        <Text style={[styles.helperText, { color: themeColors.textMuted }]}>Expiry date is the last safe date to dispense or use that drug batch.</Text>
        {errors.expiryDate ? <Text style={styles.inlineError}>{errors.expiryDate}</Text> : null}
        <View style={[styles.stockToggleCard, { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC', borderColor: themeColors.border }]}>
          <View style={styles.stockToggleCopy}>
            <Text style={[styles.stockToggleTitle, { color: themeColors.text }]}>Availability</Text>
            <Text style={[styles.stockToggleText, { color: themeColors.textMuted }]}>Switch this off when the item is out of stock or not available for dispensing.</Text>
          </View>
          <View style={styles.stockToggleRow}>
            <Text style={[styles.stockToggleState, form.isActive ? styles.inStockText : styles.outOfStockText]}>
              {form.isActive ? 'In stock' : 'Out of stock'}
            </Text>
            <Switch
              onValueChange={(isActive) => setForm((current) => ({ ...current, isActive }))}
              thumbColor={colors.surface}
              trackColor={{ false: '#FCA5A5', true: '#86EFAC' }}
              value={form.isActive}
            />
          </View>
        </View>
        <AppInput editable={canEdit} label="Description" multiline onChangeText={(description) => setForm((current) => ({ ...current, description }))} value={form.description} />

        <View style={styles.photoBlock}>
          <Text style={[styles.photoTitle, { color: themeColors.text }]}>Drug photo</Text>
          <Text style={[styles.photoSubtitle, { color: themeColors.textMuted }]}>Optional. Save the drug first, then upload a product photo.</Text>
          {imageUrl ? (
            <Image source={{ uri: `${getFileBaseUrl()}/${imageUrl}` }} style={styles.photoPreview} />
          ) : (
            <View style={[styles.photoPlaceholder, { backgroundColor: isDark ? themeColors.surfaceMuted : '#F8FBFC' }]}>
              <Text style={[styles.photoPlaceholderText, { color: themeColors.textMuted }]}>No photo uploaded</Text>
            </View>
          )}
        </View>

        {canEdit ? (
          <View style={styles.actions}>
            {existingDrug ? <AppButton loading={uploadingImage} onPress={handleUploadImage} title="Upload photo" variant="secondary" /> : null}
            <AppButton loading={submitting} onPress={handleSave} title="Save drug item" />
            {existingDrug ? <AppButton onPress={handleDelete} title="Delete" variant="danger" /> : null}
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
  stockToggleCard: {
    backgroundColor: '#F8FBFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  stockToggleCopy: {
    gap: spacing.xs,
  },
  stockToggleTitle: {
    color: colors.text,
    fontWeight: '700',
  },
  stockToggleText: {
    color: colors.textMuted,
    lineHeight: 20,
  },
  stockToggleRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stockToggleState: {
    fontWeight: '800',
  },
  inStockText: {
    color: colors.success,
  },
  outOfStockText: {
    color: colors.danger,
  },
  photoBlock: {
    marginBottom: spacing.md,
  },
  photoTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  photoSubtitle: {
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  photoPreview: {
    width: '100%',
    height: 220,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  photoPlaceholder: {
    height: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FBFC',
  },
  photoPlaceholderText: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  actions: {
    gap: spacing.md,
  },
  inlineError: {
    color: colors.danger,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  helperText: {
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
});
