import { QueryState } from '@/components/query-state';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { useWorkouts } from '@/features/workouts/hooks';

/** Other coaches' plans in the gym, read only, for owners and supervisors to review. */
export function TrainerPlans() {
  const profile = useProfile();
  const gym = useActiveGym();
  const workouts = useWorkouts(gym.gymId);

  return (
    <QueryState
      query={workouts}
      isEmpty={(list) => list.every((w) => w.trainerId === profile.id)}
      emptyText="Your trainers haven't written any plans yet.">
      {(list) =>
        list
          .filter((w) => w.trainerId !== profile.id)
          .map((workout) => <WorkoutCard key={workout.id} workout={workout} showAuthor />)
      }
    </QueryState>
  );
}
