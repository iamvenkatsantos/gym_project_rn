import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { useWorkouts } from '@/features/workouts/hooks';

export default function MemberWorkoutsScreen() {
  const workouts = useWorkouts();

  return (
    <Screen>
      <QueryState query={workouts} isEmpty={(w) => w.length === 0} emptyText="No workouts yet.">
        {(list) => list.map((workout) => <WorkoutCard key={workout.id} workout={workout} />)}
      </QueryState>
    </Screen>
  );
}
