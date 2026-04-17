import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, useTheme } from '../theme';

export default function StarRatingInput({ label = 'Rating', value = 0, onChange, disabled = false }) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((ratingValue) => (
          <Pressable
            key={ratingValue}
            disabled={disabled}
            onPress={() => onChange?.(ratingValue)}
            style={styles.starButton}
          >
            <Ionicons
              color={ratingValue <= value ? '#F59E0B' : '#CBD5E1'}
              name={ratingValue <= value ? 'star' : 'star-outline'}
              size={28}
            />
          </Pressable>
        ))}
      </View>
      <Text style={[styles.caption, { color: themeColors.textMuted }]}>
        {value ? `${value}/5` : 'Select a rating'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
    color: colors.text,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  starButton: {
    paddingVertical: 4,
  },
  caption: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
