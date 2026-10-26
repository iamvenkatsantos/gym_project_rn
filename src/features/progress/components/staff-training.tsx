import { useState } from 'react';

import { QueryState } from '@/components/query-state';
import { SegmentedControl } from '@/components/segmented-control';
import { SectionHeader } from '@/components/section-header';
import { canManageGym } from '@/features/auth/types';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { MyMealPlans } from '@/features/diet/components/my-meal-plans';
import { CoachedMembers } from '@/features/members/components/coached-members';
import { GymHistory } from '@/features/progress/components/gym-history';
import { ProgressOverview } from '@/features/progress/components/progress-overview';
import { StartWorkout } from '@/features/progress/components/start-workout';
import { useWorkoutLogs } from '@/features/progress/hooks';
import { CoachSchedule } from '@/features/trainers/components/coach-schedule';
import { MyPlans } from '@/features/workouts/components/my-plans';

type Tab = 'mine' | 'coaching' | 'members';

/**
 * Training tab for owners, supervisors and trainers: their own workouts and
 * history, and the workouts of the people their role lets them follow.
 * Owners and supervisors also coach here, for gyms without (enough) trainers;
 * trainers have the same tools in their own tabs.
 */
export function StaffTraining() {
  const profile = useProfile();
  const gym = useActiveGym();
  const [tab, setTab] = useState<Tab>('mine');
  const logs = useWorkoutLogs(gym.gymId, profile.id);
  const coaches = canManageGym(gym.role);

  return (
    <>
      <SegmentedControl
        options={[
          { value: 'mine', label: 'My training' },
          ...(coaches ? [{ value: 'coaching' as const, label: 'Coaching' }] : []),
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
      ) : tab === 'coaching' ? (
        <>
          <CoachSchedule />
          <SectionHeader title="Your plans" />
          <MyPlans />
          <SectionHeader title="Diet plans" />
          <MyMealPlans />
          <CoachedMembers />
        </>
      ) : (
        <GymHistory gymId={gym.gymId} viewer={{ id: profile.id, role: gym.role }} />
      )}
    </>
  );
}
