import { useQuery } from '@tanstack/react-query';

import { listWorkouts } from '@/features/workouts/api';

export const workoutKeys = {
  all: ['workouts'] as const,
  list: (gymId: string, trainerId?: string) => [...workoutKeys.all, gymId, { trainerId }] as const,
};

export function useWorkouts(gymId: string, trainerId?: string) {
  return useQuery({
    queryKey: workoutKeys.list(gymId, trainerId),
    queryFn: () => listWorkouts(gymId, { trainerId }),
  });
}
