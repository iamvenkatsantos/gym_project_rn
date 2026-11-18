import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assignTrainer,
  changeTrainerLinks,
  listTrainerLinks,
  listTrainerRequests,
  requestTrainer,
  resolveTrainerRequest,
  withdrawTrainerRequest,
} from '@/features/coaching/api';
import type { TrainerRequestInput } from '@/features/coaching/types';
import { dietKeys } from '@/features/diet/keys';
import { memberKeys } from '@/features/members/hooks';
import { notificationKeys } from '@/features/notifications/hooks';
import { setAssignment } from '@/features/workouts/api';
import { useOptimisticWorkouts, workoutKeys } from '@/features/workouts/hooks';
import { withAssignment } from '@/features/workouts/optimistic';

export const coachingKeys = {
  all: ['coaching'] as const,
  links: (gymId: string, filter: { memberId?: string; trainerId?: string }) =>
    [...coachingKeys.all, gymId, 'links', filter] as const,
  requests: (gymId: string) => [...coachingKeys.all, gymId, 'requests'] as const,
};

export function useTrainerLinks(
  gymId: string,
  filter: { memberId?: string; trainerId?: string } = {},
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: coachingKeys.links(gymId, filter),
    queryFn: () => listTrainerLinks(gymId, filter),
    enabled,
  });
}

export function useTrainerRequests(gymId: string) {
  return useQuery({
    queryKey: coachingKeys.requests(gymId),
    queryFn: () => listTrainerRequests(gymId),
  });
}

/**
 * Mapping changes what trainers coach and which workout and diet plans members have, so
 * refresh those too.
 */
export function useInvalidateCoaching() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: coachingKeys.all }),
      queryClient.invalidateQueries({ queryKey: memberKeys.all }),
      queryClient.invalidateQueries({ queryKey: workoutKeys.all }),
      queryClient.invalidateQueries({ queryKey: dietKeys.all }),
      queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    ]);
}

/** Saves a member's trainers, or a trainer's members, in one go. */
export function useChangeTrainerLinks(
  gymId: string,
  side: { kind: 'member' | 'trainer'; id: string },
) {
  const invalidate = useInvalidateCoaching();
  return useMutation({
    mutationFn: (change: { added: string[]; removed: string[] }) =>
      changeTrainerLinks(gymId, side, change),
    onSettled: invalidate,
  });
}

const ASSIGN_PLAN_KEY = ['assign-plan'];

/**
 * Assigns or unassigns a coach's plan. Owners and supervisors can assign to any
 * member: one they don't coach yet is mapped to them first, since plans only go
 * to a coach's own members. The tick shows at once (optimistic) and only the plan
 * lists refresh after, in the background; trainer links and people refresh too only when this
 * made the coach their trainer. Before, every tap waited for people, links, plans, diet plans
 * and the inbox to download again (perf audit, 2026-11-18).
 */
export function useAssignPlan(gymId: string, coachId: string) {
  const queryClient = useQueryClient();
  const optimistic = useOptimisticWorkouts();
  return useMutation({
    mutationKey: ASSIGN_PLAN_KEY,
    mutationFn: async ({
      workoutId,
      memberId,
      assigned,
      mapFirst,
    }: {
      workoutId: string;
      memberId: string;
      assigned: boolean;
      mapFirst: boolean;
    }) => {
      if (assigned && mapFirst) await assignTrainer(gymId, memberId, coachId);
      await setAssignment(workoutId, memberId, assigned);
    },
    onMutate: async ({ workoutId, memberId, assigned }) => ({
      undo: await optimistic((list) => withAssignment(list, workoutId, memberId, assigned)),
    }),
    onError: (_error, _vars, context) => context?.undo(),
    // Not awaited, so the row is free again as soon as the save is done.
    onSettled: (_data, _error, { assigned, mapFirst }) => {
      // With quick taps on several members, refresh once after the last save, so a refetch
      // can't briefly undo ticks that are still saving.
      if (queryClient.isMutating({ mutationKey: ASSIGN_PLAN_KEY }) > 1) return;
      const keys: readonly unknown[][] = [
        [...workoutKeys.all],
        ...(assigned && mapFirst ? [[...coachingKeys.all], [...memberKeys.all]] : []),
      ];
      for (const queryKey of keys) queryClient.invalidateQueries({ queryKey }).catch(() => {});
    },
  });
}

export function useRequestTrainer(gymId: string, memberId: string) {
  const invalidate = useInvalidateCoaching();
  return useMutation({
    mutationFn: (input: TrainerRequestInput) => requestTrainer(gymId, memberId, input),
    onSettled: invalidate,
  });
}

export function useWithdrawTrainerRequest() {
  const invalidate = useInvalidateCoaching();
  return useMutation({ mutationFn: withdrawTrainerRequest, onSettled: invalidate });
}

export function useResolveTrainerRequest(gymId: string) {
  const invalidate = useInvalidateCoaching();
  return useMutation({
    mutationFn: ({
      requestId,
      ...decision
    }: {
      requestId: string;
      approve: boolean;
      trainerId: string | null;
      response: string;
    }) => resolveTrainerRequest(gymId, requestId, decision),
    onSettled: invalidate,
  });
}
