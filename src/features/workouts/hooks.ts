import { useQuery } from '@tanstack/react-query';

import { listWorkouts } from '@/features/workouts/api';

export const workoutKeys = {
  all: ['workouts'] as const,
  list: (trainerId?: string) => [...workoutKeys.all, { trainerId }] as const,
};

export function useWorkouts(trainerId?: string) {
  return useQuery({
    queryKey: workoutKeys.list(trainerId),
    queryFn: () => listWorkouts({ trainerId }),
  });
}
