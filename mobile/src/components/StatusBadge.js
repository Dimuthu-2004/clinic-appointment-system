import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../theme';

const tones = {
  scheduled: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  confirmed: { backgroundColor: '#DCFCE7', color: '#15803D' },
  completed: { backgroundColor: '#D1FAE5', color: '#047857' },
  cancelled: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
  pending: { backgroundColor: '#FEF3C7', color: '#B45309' },
  paid: { backgroundColor: '#DCFCE7', color: '#15803D' },
  refunded: { backgroundColor: '#E0E7FF', color: '#4338CA' },
  active: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  archived: { backgroundColor: '#E5E7EB', color: '#4B5563' },
  out_of_stock: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
  dismissed: { backgroundColor: '#E5E7EB', color: '#4B5563' },
};

export default function StatusBadge({ value }) {
  const tone = tones[value] || { backgroundColor: colors.surfaceMuted, color: colors.textMuted };

  return (
    <View style={[styles.badge, { backgroundColor: tone.backgroundColor }]}>
      <Text style={[styles.label, { color: tone.color }]}>{String(value || 'n/a').replace(/_/g, ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
