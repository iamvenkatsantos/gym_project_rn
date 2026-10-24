import { useQuery } from '@tanstack/react-query';

import { listExercises } from '@/features/exercises/api';

export const exerciseKeys = {
  all: ['exercises'] as const,
  list: (gymId: string) => [...exerciseKeys.all, gymId] as const,
};

export function useExercises(gymId: string) {
  return useQuery({
    queryKey: exerciseKeys.list(gymId),
    queryFn: () => listExercises(gymId),
    staleTime: 10 * 60 * 1000,
  });
}

/** One exercise out of the cached library list. */
export function useExercise(gymId: string, exerciseId: string) {
  const query = useExercises(gymId);
  return { ...query, exercise: query.data?.find((e) => e.id === exerciseId) };
}
