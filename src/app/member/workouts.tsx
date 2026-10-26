import { useState } from 'react';

import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { MemberDietPlan } from '@/features/diet/components/member-diet-plan';
import { ExerciseLibrary } from '@/features/exercises/components/exercise-library';
import { StartWorkout } from '@/features/progress/components/start-workout';

type Tab = 'plans' | 'diet' | 'exercises';

export default function MemberWorkoutsScreen() {
  const gym = useActiveGym();
  const profile = useProfile();
  const [tab, setTab] = useState<Tab>('plans');

  return (
    <Screen>
      <SegmentedControl
        options={[
          { value: 'plans', label: 'Plans' },
          { value: 'diet', label: 'Diet' },
          { value: 'exercises', label: 'Exercises' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'plans' ? (
        <StartWorkout gymId={gym.gymId} />
      ) : tab === 'diet' ? (
        <MemberDietPlan gymId={gym.gymId} memberId={profile.id} />
      ) : (
        <ExerciseLibrary gymId={gym.gymId} />
      )}
    </Screen>
  );
}
