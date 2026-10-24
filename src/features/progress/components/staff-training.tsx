import { useState } from 'react';

import { QueryState } from '@/components/query-state';
import { SegmentedControl } from '@/components/segmented-control';
import { SectionHeader } from '@/components/section-header';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { GymHistory } from '@/features/progress/components/gym-history';
import { ProgressOverview } from '@/features/progress/components/progress-overview';
import { StartWorkout } from '@/features/progress/components/start-workout';
import { useWorkoutLogs } from '@/features/progress/hooks';

type Tab = 'mine' | 'members';

/**
 * Training tab for owners, supervisors and trainers: their own workouts and
 * history, and the workouts of the people their role lets them follow.
 */
export function StaffTraining() {
  const profile = useProfile();
  const gym = useActiveGym();
  const [tab, setTab] = useState<Tab>('mine');
  const logs = useWorkoutLogs(gym.gymId, profile.id);

  return (
    <>
      <SegmentedControl
        options={[
          { value: 'mine', label: 'My training' },
          { value: 'members', label: gym.role === 'trainer' ? 'My members' : 'Gym' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'mine' ? (
        <>
          <StartWorkout gymId={gym.gymId} />
          <SectionHeader title="Your progress" />
          <QueryState
            query={logs}
            isEmpty={(list) => list.length === 0}
            emptyText="Finish your first workout to start tracking progress.">
            {(list) => <ProgressOverview logs={list} />}
          </QueryState>
        </>
      ) : (
        <GymHistory gymId={gym.gymId} viewer={{ id: profile.id, role: gym.role }} />
      )}
    </>
  );
}
