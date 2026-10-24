import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { useWorkouts } from '@/features/workouts/hooks';

export default function TrainerWorkoutsScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const workouts = useWorkouts(gym.gymId, profile.id);

  return (
    <Screen>
      <QueryState
        query={workouts}
        isEmpty={(w) => w.length === 0}
        emptyText="You haven't created any workouts yet.">
        {(list) => list.map((workout) => <WorkoutCard key={workout.id} workout={workout} />)}
      </QueryState>
    </Screen>
  );
}
