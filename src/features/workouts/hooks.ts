import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteWorkout,
  getCatchUpDays,
  listWorkouts,
  saveWorkout,
  setAssignment,
  setAssignmentDays,
  setCatchUpDays,
} from '@/features/workouts/api';
import { withDays } from '@/features/workouts/optimistic';
import type { Workout } from '@/features/workouts/types';

export const workoutKeys = {
  all: ['workouts'] as const,
  list: (gymId: string, trainerId?: string) => [...workoutKeys.all, gymId, { trainerId }] as const,
  catchUp: (gymId: string) => [...workoutKeys.all, gymId, 'catch-up'] as const,
};

export function useWorkouts(gymId: string, trainerId?: string) {
  return useQuery({
    queryKey: workoutKeys.list(gymId, trainerId),
    queryFn: () => listWorkouts(gymId, { trainerId }),
  });
}

/** One of the trainer's plans, out of their cached list. */
export function useWorkout(gymId: string, trainerId: string, workoutId: string | undefined) {
  const query = useWorkouts(gymId, trainerId);
  return { ...query, workout: query.data?.find((w) => w.id === workoutId) };
}

function useInvalidateWorkouts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: workoutKeys.all });
}

export function useSaveWorkout() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({ mutationFn: saveWorkout, onSettled: invalidate });
}

export function useDeleteWorkout() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({ mutationFn: deleteWorkout, onSettled: invalidate });
}

export function useSetAssignment() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({
    mutationFn: ({
      workoutId,
      memberId,
      assigned,
    }: {
      workoutId: string;
      memberId: string;
      assigned: boolean;
    }) => setAssignment(workoutId, memberId, assigned),
    onSettled: invalidate,
  });
}

/**
 * Changes plan lists in the cache straight away (Assign shows the change on tap) and gives back
 * a way to undo it if the server refuses.
 */
export function useOptimisticWorkouts() {
  const queryClient = useQueryClient();
  return async (change: (list: Workout[]) => Workout[]) => {
    await queryClient.cancelQueries({ queryKey: workoutKeys.all });
    const before = queryClient.getQueriesData<Workout[]>({ queryKey: workoutKeys.all });
    for (const [key, data] of before) {
      // The catch-up days setting lives under the same key; only plan lists change.
      if (Array.isArray(data)) queryClient.setQueryData(key, change(data));
    }
    return () => {
      for (const [key, data] of before) queryClient.setQueryData(key, data);
    };
  };
}

export function useSetAssignmentDays() {
  const queryClient = useQueryClient();
  const optimistic = useOptimisticWorkouts();
  return useMutation({
    mutationFn: ({
      workoutId,
      memberId,
      days,
    }: {
      workoutId: string;
      memberId: string;
      days: number[];
    }) => setAssignmentDays(workoutId, memberId, days),
    onMutate: async ({ workoutId, memberId, days }) => ({
      undo: await optimistic((list) => withDays(list, workoutId, memberId, days)),
    }),
    onError: (_error, _vars, context) => context?.undo(),
    // Not awaited: the days already show, so the server's copy refreshes in the background.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.all }).catch(() => {});
    },
  });
}

/** Days a missed weekday workout stays open at the gym. */
export function useCatchUpDays(gymId: string) {
  return useQuery({
    queryKey: workoutKeys.catchUp(gymId),
    queryFn: () => getCatchUpDays(gymId),
  });
}

export function useSetCatchUpDays(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (days: number) => setCatchUpDays(gymId, days),
    onMutate: (days) => queryClient.setQueryData(workoutKeys.catchUp(gymId), days),
    onSettled: () => queryClient.invalidateQueries({ queryKey: workoutKeys.catchUp(gymId) }),
  });
}
