import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { assignTrainer } from '@/features/coaching/api';
import { useInvalidateCoaching } from '@/features/coaching/hooks';
import {
  deleteMealPlan,
  getMemberMealPlan,
  listMealPlans,
  saveMealPlan,
  setMealPlanAssignment,
} from '@/features/diet/api';
import { dietKeys } from '@/features/diet/keys';

export function useMealPlans(gymId: string, coachId: string) {
  return useQuery({
    queryKey: dietKeys.plans(gymId, coachId),
    queryFn: () => listMealPlans(gymId, coachId),
  });
}

/** One of the coach's plans, out of their cached list. */
export function useMealPlan(gymId: string, coachId: string, planId: string | undefined) {
  const query = useMealPlans(gymId, coachId);
  return { ...query, plan: query.data?.find((p) => p.id === planId) };
}

/** The diet plan the member is on, or null. */
export function useMemberMealPlan(gymId: string, memberId: string) {
  return useQuery({
    queryKey: dietKeys.member(gymId, memberId),
    queryFn: () => getMemberMealPlan(gymId, memberId),
  });
}

function useInvalidateDiet() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: dietKeys.all });
}

export function useSaveMealPlan() {
  const invalidate = useInvalidateDiet();
  return useMutation({ mutationFn: saveMealPlan, onSettled: invalidate });
}

export function useDeleteMealPlan() {
  const invalidate = useInvalidateDiet();
  return useMutation({ mutationFn: deleteMealPlan, onSettled: invalidate });
}

/**
 * Puts a member on a coach's diet plan or takes them off it. As with workout plans, owners
 * and supervisors can pick any member: one they don't coach yet is mapped to them first.
 */
export function useAssignMealPlan(gymId: string, coachId: string) {
  const invalidateDiet = useInvalidateDiet();
  const invalidateCoaching = useInvalidateCoaching();
  return useMutation({
    mutationFn: async ({
      planId,
      memberId,
      assigned,
      mapFirst,
    }: {
      planId: string;
      memberId: string;
      assigned: boolean;
      mapFirst: boolean;
    }) => {
      if (assigned && mapFirst) await assignTrainer(gymId, memberId, coachId);
      await setMealPlanAssignment(planId, memberId, assigned);
    },
    // Mapping someone new changes who the coach trains too.
    onSettled: (_data, _error, { mapFirst }) =>
      mapFirst ? invalidateCoaching() : invalidateDiet(),
  });
}
