import { StyleSheet, Text, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { radii, spacing, useTheme } from '../theme';

export default function AppSelect({ label, value, onValueChange, items, enabled = true }) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }, !enabled && styles.disabled]}>
        <Picker
          dropdownIconColor={colors.text}
          enabled={enabled}
          selectedValue={value}
          onValueChange={onValueChange}
          style={{ color: colors.text }}
        >
          <Picker.Item label="Select an option" value="" />
          {items.map((item) => (
            <Picker.Item key={`${label}-${item.value}`} label={item.label} value={item.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  container: {
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.75,
  },
});
