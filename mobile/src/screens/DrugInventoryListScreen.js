import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import api, { getFileBaseUrl } from '../api/client';
import AppButton from '../components/AppButton';
import EmptyState from '../components/EmptyState';
import EntityCard from '../components/EntityCard';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../hooks/useAuth';
import { colors, radii, spacing, useTheme } from '../theme';

const getDrugStatus = (drug) => {
  if (!drug.isActive || Number(drug.quantityInStock) <= 0) {
    return 'out_of_stock';
  }

  if (Number(drug.quantityInStock) <= Number(drug.reorderLevel || 0)) {
    return 'pending';
  }

  return 'active';
};

export default function DrugInventoryListScreen({ navigation }) {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const isFocused = useIsFocused();
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDrugs = async () => {
      try {
        setLoading(true);
        const response = await api.get('/drugs');
        setDrugs(response.data.data);
      } catch (error) {
        Alert.alert('Unable to load drug inventory', error?.response?.data?.message || 'Try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (isFocused) {
      loadDrugs();
    }
  }, [isFocused]);

  if (loading) {
    return <LoadingOverlay message="Loading drug inventory..." />;
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: themeColors.text }]}>Pharmacy inventory</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
            Add medicines, update prices or stock, mark items out of stock, upload an optional photo, and remove items when needed.
          </Text>
        </View>
        {user?.role === 'pharmacist' ? (
          <AppButton title="Add drug" onPress={() => navigation.navigate('DrugForm')} />
        ) : null}
      </View>

      {drugs.length === 0 ? (
        <EmptyState message="No drug items are stored yet." title="No inventory items" />
      ) : (
        drugs.map((drug) => (
          <EntityCard
            key={drug._id}
            footer={
              drug.imageUrl ? (
                <View style={styles.imageWrap}>
                  <Image source={{ uri: `${getFileBaseUrl()}/${drug.imageUrl}` }} style={styles.previewImage} />
                </View>
              ) : null
            }
            meta={[
              `Price: LKR ${Number(drug.unitPrice || 0).toFixed(2)}`,
              `Stock: ${drug.quantityInStock}`,
              `Reorder level: ${drug.reorderLevel || 0}`,
              `Expiry: ${new Date(drug.expiryDate).toLocaleDateString()}`,
            ]}
            onPress={() => navigation.navigate('DrugForm', { drug })}
            status={getDrugStatus(drug)}
            subtitle={`${drug.genericName || 'Generic not set'} | ${drug.strength || 'Strength not set'}`}
            title={drug.name}
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
  imageWrap: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
});
