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
import { workoutKeys } from '@/features/workouts/hooks';

export const coachingKeys = {
  all: ['coaching'] as const,
  links: (gymId: string, filter: { memberId?: string; trainerId?: string }) =>
    [...coachingKeys.all, gymId, 'links', filter] as const,
  requests: (gymId: string) => [...coachingKeys.all, gymId, 'requests'] as const,
};

export function useTrainerLinks(
  gymId: string,
  filter: { memberId?: string; trainerId?: string } = {},
) {
  return useQuery({
    queryKey: coachingKeys.links(gymId, filter),
    queryFn: () => listTrainerLinks(gymId, filter),
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

/**
 * Assigns or unassigns a coach's plan. Owners and supervisors can assign to any
 * member: one they don't coach yet is mapped to them first, since plans only go
 * to a coach's own members.
 */
export function useAssignPlan(gymId: string, coachId: string) {
  const invalidate = useInvalidateCoaching();
  return useMutation({
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
    onSettled: invalidate,
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
