import type { MealPlan } from '@/features/diet/types';

/** Which of the coach's plans a member is on, if any. A member is on at most one. */
export function otherPlanOf(plans: MealPlan[], memberId: string) {
  return plans.find((p) => p.assignedMemberIds.includes(memberId)) ?? null;
}
