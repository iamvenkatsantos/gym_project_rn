import { useState } from 'react';

import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { useActiveGym } from '@/features/auth/use-profile';
import { ExerciseLibrary } from '@/features/exercises/components/exercise-library';
import { StartWorkout } from '@/features/progress/components/start-workout';

type Tab = 'plans' | 'exercises';

export default function MemberWorkoutsScreen() {
  const gym = useActiveGym();
  const [tab, setTab] = useState<Tab>('plans');

  return (
    <Screen>
      <SegmentedControl
        options={[
          { value: 'plans', label: 'Plans' },
          { value: 'exercises', label: 'Exercises' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'plans' ? <StartWorkout gymId={gym.gymId} /> : <ExerciseLibrary gymId={gym.gymId} />}
    </Screen>
  );
}
