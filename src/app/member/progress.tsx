import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { ProgressOverview } from '@/features/progress/components/progress-overview';
import { useWorkoutLogs } from '@/features/progress/hooks';

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
        {(list) => <ProgressOverview logs={list} />}
      </QueryState>
      <ThemedText type="small" themeColor="textSecondary">
        Body weight and measurements are coming next.
      </ThemedText>
    </Screen>
  );
}
