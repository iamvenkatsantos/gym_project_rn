import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { WorkoutLog } from '@/features/progress/types';
import { selfCheckSummary } from '@/features/self-workouts/rules';

/** A workout's self-check, swaps and the trainer's reply, as short lines under the workout. */
export function SelfCheckLines({ log }: { log: WorkoutLog }) {
  const check = log.selfCheck;
  const swaps = log.swaps ?? [];
  if (!check && swaps.length === 0 && !log.reply) return null;
  return (
    <View style={styles.lines}>
      {check ? (
        <ThemedText type="small" themeColor={check.pain ? 'warning' : 'text'}>
          {selfCheckSummary(check)}
        </ThemedText>
      ) : null}
      {check?.note ? (
        <ThemedText type="small" themeColor="textSecondary">
          “{check.note}”
        </ThemedText>
      ) : null}
      {swaps.map((swap) => (
        <View key={swap} style={styles.row}>
          <Icon name="swap-horizontal" size={14} color="textSecondary" />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {swap}
          </ThemedText>
        </View>
      ))}
      {log.reply ? (
        <View style={styles.row}>
          <Icon name="chatbubble-ellipses-outline" size={14} color="accent" />
          <ThemedText type="small" style={styles.flex}>
            <ThemedText type="smallBold">{log.reply.byName ?? 'Trainer'}: </ThemedText>
            {log.reply.text}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lines: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one,
  },
  flex: {
    flex: 1,
  },
});
