import { useState } from 'react';

import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { useActiveGym } from '@/features/auth/use-profile';
import { ExerciseLibrary } from '@/features/exercises/components/exercise-library';
import { MyPlans } from '@/features/workouts/components/my-plans';

type Tab = 'plans' | 'exercises';

export default function TrainerWorkoutsScreen() {
  const gym = useActiveGym();
  const [tab, setTab] = useState<Tab>('plans');

  return (
    <Screen>
      <SegmentedControl
        options={[
          { value: 'plans', label: 'My plans' },
          { value: 'exercises', label: 'Exercises' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'plans' ? <MyPlans /> : <ExerciseLibrary gymId={gym.gymId} />}
    </Screen>
  );
}
