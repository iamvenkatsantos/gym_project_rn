import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  durationMinutes,
  personalRecords,
  volumeKg,
  weekStreak,
  workoutsThisWeek,
} from '@/features/progress/rules';
import type { WorkoutLog } from '@/features/progress/types';
import { formatRelativeDay } from '@/lib/format';

/** Stats, personal records and history for one member's logs. Used by the member and their trainer. */
export function ProgressOverview({ logs }: { logs: WorkoutLog[] }) {
  return (
    <>
      <View style={styles.grid}>
        <StatTile label="This week" value={workoutsThisWeek(logs)} icon="flame" accent compact />
        <StatTile
          label="Week streak"
          value={weekStreak(logs)}
          icon="calendar-number-outline"
          compact
        />
        <StatTile label="Workouts" value={logs.length} icon="barbell-outline" compact />
      </View>

      <SectionHeader title="Personal records" />
      <Card>
        {personalRecords(logs).map((record) => (
          <View key={record.exerciseId} style={styles.row}>
            <ThemedText type="small" style={styles.flex}>
              {record.exerciseName}
            </ThemedText>
            <ThemedText type="smallBold" themeColor="accent">
              {record.weightKg ? `${record.weightKg} kg × ${record.reps}` : `${record.reps} reps`}
            </ThemedText>
          </View>
        ))}
      </Card>

      <SectionHeader title="History" />
      {logs.map((log) => {
        const volume = volumeKg(log);
        return (
          <Card key={log.clientId}>
            <View style={styles.row}>
              <ThemedText type="heading" style={styles.flex}>
                {log.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatRelativeDay(log.completedAt)}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {durationMinutes(log)} min · {log.sets.length} sets
              {volume ? ` · ${Math.round(volume).toLocaleString()} kg lifted` : ''}
            </ThemedText>
          </Card>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
