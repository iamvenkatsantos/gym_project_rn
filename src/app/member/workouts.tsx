import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { useActiveGym } from '@/features/auth/use-profile';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { useWorkouts } from '@/features/workouts/hooks';

export default function MemberWorkoutsScreen() {
  const gym = useActiveGym();
  const workouts = useWorkouts(gym.gymId);

  return (
    <Screen>
      <QueryState query={workouts} isEmpty={(w) => w.length === 0} emptyText="No workouts yet.">
        {(list) => list.map((workout) => <WorkoutCard key={workout.id} workout={workout} />)}
      </QueryState>
    </Screen>
  );
}
