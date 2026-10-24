import { useState } from 'react';

import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { ExerciseLibrary } from '@/features/exercises/components/exercise-library';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { useWorkouts } from '@/features/workouts/hooks';

type Tab = 'plans' | 'exercises';

export default function TrainerWorkoutsScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const workouts = useWorkouts(gym.gymId, profile.id);
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
      {tab === 'plans' ? (
        <QueryState
          query={workouts}
          isEmpty={(w) => w.length === 0}
          emptyText="You haven't created any plans yet.">
          {(list) => list.map((workout) => <WorkoutCard key={workout.id} workout={workout} />)}
        </QueryState>
      ) : (
        <ExerciseLibrary gymId={gym.gymId} />
      )}
    </Screen>
  );
}
