import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, useTheme } from '../theme';

export default function AppInput({
  label,
  error,
  multiline = false,
  secureTextEntry = false,
  style,
  ...props
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const showVisibilityToggle = secureTextEntry && !multiline;
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          multiline={multiline}
          secureTextEntry={showVisibilityToggle ? !passwordVisible : secureTextEntry}
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
            multiline && styles.multiline,
            showVisibilityToggle && styles.inputWithToggle,
            style,
          ]}
          {...props}
        />
        {showVisibilityToggle ? (
          <Pressable onPress={() => setPasswordVisible((current) => !current)} style={styles.toggleButton}>
            <Ionicons
              color={colors.textMuted}
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
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
  inputWrap: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  inputWithToggle: {
    paddingRight: 48,
  },
  multiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  toggleButton: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    marginTop: spacing.xs,
    fontSize: 12,
  },
});
