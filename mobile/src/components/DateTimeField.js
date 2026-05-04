import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { radii, spacing, useTheme } from '../theme';
import { formatDateOnly, formatDateTime, toDateKey } from '../utils/date';

export default function DateTimeField({
  label,
  value,
  onChange,
  mode = 'datetime',
  minimumDate,
  allowPastDates = false,
  disabled = false,
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [androidPickerMode, setAndroidPickerMode] = useState(mode === 'datetime' ? 'date' : mode);
  const { colors, isDark } = useTheme();
  const isAndroidDateTimeMode = Platform.OS === 'android' && mode === 'datetime';

  const currentDate =
    mode === 'date' && value
      ? new Date(`${toDateKey(value)}T00:00:00`)
      : value
        ? new Date(value)
        : new Date();

  const handleAndroidDateTimeChange = (event, selectedDate) => {
    if (event?.type === 'dismissed') {
      setShowPicker(false);
      setAndroidPickerMode('date');
      return;
    }

    if (!selectedDate) {
      return;
    }

    if (androidPickerMode === 'date') {
      const nextDate = new Date(currentDate);
      nextDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      nextDate.setSeconds(0, 0);
      onChange(nextDate.toISOString());
      setAndroidPickerMode('time');
      return;
    }

    const nextDate = new Date(currentDate);
    nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
    onChange(nextDate.toISOString());
    setShowPicker(false);
    setAndroidPickerMode('date');
  };

  const handleChange = (event, selectedDate) => {
    if (isAndroidDateTimeMode) {
      handleAndroidDateTimeChange(event, selectedDate);
      return;
    }

    if (Platform.OS !== 'ios') {
      setShowPicker(false);
    }

    if (selectedDate) {
      onChange(mode === 'date' ? toDateKey(selectedDate) : selectedDate.toISOString());
    }
  };

  const pickerMode = isAndroidDateTimeMode ? androidPickerMode : mode;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <Pressable
        disabled={disabled}
        style={[
          styles.field,
          { backgroundColor: colors.surface, borderColor: colors.border },
          disabled && styles.disabled,
        ]}
        onPress={() => {
          setAndroidPickerMode(mode === 'datetime' ? 'date' : mode);
          setShowPicker(true);
        }}
      >
        <Text style={[styles.value, { color: colors.text }]}>{mode === 'date' ? formatDateOnly(value) : formatDateTime(value)}</Text>
      </Pressable>
      {showPicker && !disabled ? (
        <DateTimePicker
          mode={pickerMode}
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
  disabled: {
    opacity: 0.7,
  },
  value: {
  },
});
