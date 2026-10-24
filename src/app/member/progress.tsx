import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useWorkoutLogs } from '@/features/progress/hooks';
import {
  durationMinutes,
  personalRecords,
  volumeKg,
  weekStreak,
  workoutsThisWeek,
} from '@/features/progress/rules';
import { formatRelativeDay } from '@/lib/format';

export default function MemberProgressScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const logs = useWorkoutLogs(gym.gymId, profile.id);

  return (
    <Screen>
      <QueryState
        query={logs}
        isEmpty={(list) => list.length === 0}
        emptyText="Finish your first workout to start tracking progress.">
        {(list) => (
          <>
            <View style={styles.grid}>
              <StatTile label="This week" value={workoutsThisWeek(list)} icon="flame" accent />
              <StatTile
                label="Week streak"
                value={weekStreak(list)}
                icon="calendar-number-outline"
              />
              <StatTile label="Workouts" value={list.length} icon="barbell-outline" />
            </View>

            <SectionHeader title="Personal records" />
            <Card>
              {personalRecords(list).map((record) => (
                <View key={record.exerciseId} style={styles.row}>
                  <ThemedText type="small" style={styles.flex}>
                    {record.exerciseName}
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="primary">
                    {record.weightKg
                      ? `${record.weightKg} kg × ${record.reps}`
                      : `${record.reps} reps`}
                  </ThemedText>
                </View>
              ))}
            </Card>

            <SectionHeader title="History" />
            {list.map((log) => {
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
        )}
      </QueryState>
      <ThemedText type="small" themeColor="textSecondary">
        Body weight and measurements are coming next.
      </ThemedText>
    </Screen>
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
