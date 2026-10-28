import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { changesLabel } from '@/features/coaching/rules';
import { useTheme } from '@/hooks/use-theme';

/**
 * Pinned under a long pick list so Save is always in reach. Only shows once something
 * changed, with a warning when the save takes trainers off members.
 */
export function SaveBar({
  change,
  warning,
  error,
  saving,
  onSave,
  onReset,
}: {
  change: { added: string[]; removed: string[] };
  warning?: string;
  error?: string;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (!change.added.length && !change.removed.length) return null;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          paddingBottom: Spacing.three + insets.bottom,
        },
      ]}>
      <View style={styles.inner}>
        {change.removed.length && warning ? (
          <ThemedText type="small" themeColor="warning">
            {warning}
          </ThemedText>
        ) : null}
        {error ? <ThemedText themeColor="danger">{error}</ThemedText> : null}
        <View style={styles.row}>
          <View style={styles.undo}>
            <Button label="Undo" variant="secondary" disabled={saving} onPress={onReset} />
          </View>
          <View style={styles.save}>
            <Button
              label={changesLabel(change)}
              icon="checkmark"
              loading={saving}
              onPress={onSave}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  inner: {
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  undo: {
    flex: 1,
  },
  save: {
    flex: 2,
  },
});
