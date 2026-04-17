import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { radii, spacing, useTheme } from '../theme';
import { formatDateOnly, formatDateTime, toDateKey } from '../utils/date';

export default function DateTimeField({ label, value, onChange, mode = 'datetime', minimumDate, allowPastDates = false }) {
  const [showPicker, setShowPicker] = useState(false);
  const { colors, isDark } = useTheme();

  const currentDate =
    mode === 'date' && value
      ? new Date(`${toDateKey(value)}T00:00:00`)
      : value
        ? new Date(value)
        : new Date();

  const handleChange = (_event, selectedDate) => {
    if (Platform.OS !== 'ios') {
      setShowPicker(false);
    }

    if (selectedDate) {
      onChange(mode === 'date' ? toDateKey(selectedDate) : selectedDate.toISOString());
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Pressable style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowPicker(true)}>
        <Text style={[styles.value, { color: colors.text }]}>{mode === 'date' ? formatDateOnly(value) : formatDateTime(value)}</Text>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          mode={mode}
          value={currentDate}
          onChange={handleChange}
          minimumDate={allowPastDates ? undefined : minimumDate || new Date()}
          themeVariant={isDark ? 'dark' : 'light'}
        />
      ) : null}
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
  field: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
  },
  value: {
  },
});
