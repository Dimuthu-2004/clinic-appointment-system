import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, shadow, spacing, useTheme } from '../theme';
import StatusBadge from './StatusBadge';

export default function EntityCard({ title, subtitle, meta = [], status, onPress, footer }) {
  const { colors } = useTheme();

  return (
    <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        </View>
        {status ? <StatusBadge value={status} /> : null}
      </View>
      {meta.map((line, index) => (
        <Text key={`${title}-${index}-${line}`} style={[styles.meta, { color: colors.text }]}>
          {line}
        </Text>
      ))}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    ...shadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
  },
  meta: {
    marginTop: 4,
  },
  footer: {
    marginTop: spacing.md,
  },
});
