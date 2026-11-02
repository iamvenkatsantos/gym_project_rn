import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCatchUpDays, useSetCatchUpDays } from '@/features/workouts/hooks';
import { CatchUpLimits } from '@/features/workouts/schedule';

const label = (days: number) => (days === 0 ? 'Off' : days === 1 ? '1 day' : `${days} days`);

/** Owners and supervisors: how long a missed weekday workout stays open. */
export function CatchUpSetting({ gymId }: { gymId: string }) {
  const catchUp = useCatchUpDays(gymId);
  const save = useSetCatchUpDays(gymId);

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.text}>
          <ThemedText type="smallBold">Catch-up days</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Missed a plan&apos;s day? Members can still do it for this long.
          </ThemedText>
        </View>
        <Stepper
          label="Catch-up days"
          value={catchUp.data ?? 1}
          {...CatchUpLimits}
          format={label}
          onChange={(days) => save.mutate(days)}
        />
      </View>
      {save.error ? (
        <ThemedText type="small" themeColor="danger">
          Couldn&apos;t save: {save.error.message}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  text: {
    flexGrow: 1,
    flexBasis: 160,
  },
});
