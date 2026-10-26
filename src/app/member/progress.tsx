import { useState } from 'react';

import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { BodyProgress } from '@/features/body/components/body-progress';
import { ProgressOverview } from '@/features/progress/components/progress-overview';
import { useWorkoutLogs } from '@/features/progress/hooks';

type View = 'workouts' | 'body';

export default function MemberProgressScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const logs = useWorkoutLogs(gym.gymId, profile.id);
  const [view, setView] = useState<View>('workouts');

  return (
    <Screen>
      <SegmentedControl<View>
        options={[
          { value: 'workouts', label: 'Workouts' },
          { value: 'body', label: 'Body' },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'workouts' ? (
        <QueryState
          query={logs}
          isEmpty={(list) => list.length === 0}
          emptyText="Finish your first workout to start tracking progress.">
          {(list) => <ProgressOverview logs={list} />}
        </QueryState>
      ) : (
        <BodyProgress gymId={gym.gymId} memberId={profile.id} editable />
      )}
    </Screen>
  );
}
