import { useState } from 'react';

import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { useActiveGym } from '@/features/auth/use-profile';
import { MyMealPlans } from '@/features/diet/components/my-meal-plans';
import { ExerciseLibrary } from '@/features/exercises/components/exercise-library';
import { MyPlans } from '@/features/workouts/components/my-plans';

type Tab = 'plans' | 'diet' | 'exercises';

export default function TrainerWorkoutsScreen() {
  const gym = useActiveGym();
  const [tab, setTab] = useState<Tab>('plans');

  return (
    <Screen>
      <SegmentedControl
        options={[
          { value: 'plans', label: 'My plans' },
          { value: 'diet', label: 'Diet' },
          { value: 'exercises', label: 'Exercises' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'plans' ? (
        <MyPlans />
      ) : tab === 'diet' ? (
        <MyMealPlans />
      ) : (
        <ExerciseLibrary gymId={gym.gymId} />
      )}
    </Screen>
  );
}
