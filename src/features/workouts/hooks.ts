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

export function useSetAssignmentDays() {
  const invalidate = useInvalidateWorkouts();
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
    onSettled: invalidate,
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
