import type { Workout } from '@/features/workouts/types';

/** The plan list with a member ticked or unticked on one plan, before the server answers. */
export function withAssignment(
  list: Workout[],
  workoutId: string,
  memberId: string,
  assigned: boolean,
): Workout[] {
  return list.map((w) => {
    if (w.id !== workoutId) return w;
    const others = w.assignedMemberIds.filter((id) => id !== memberId);
    const memberDays = { ...w.memberDays };
    if (!assigned) delete memberDays[memberId];
    return {
      ...w,
      assignedMemberIds: assigned ? [...others, memberId] : others,
      memberDays,
    };
  });
}

/** The plan list with a member's days changed on one plan, before the server answers. */
export function withDays(
  list: Workout[],
  workoutId: string,
  memberId: string,
  days: number[],
): Workout[] {
  return list.map((w) =>
    w.id === workoutId ? { ...w, memberDays: { ...w.memberDays, [memberId]: days } } : w,
  );
}
