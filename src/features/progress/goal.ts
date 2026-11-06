import { startOfWeek } from '@/features/progress/rules';
import type { WorkoutLog } from '@/features/progress/types';
import { isoWeekday, normaliseDays } from '@/features/workouts/schedule';
import type { Workout } from '@/features/workouts/types';

/**
 * Weekly goal ring. A member's goal is the number of weekdays their assigned plans fall on
 * (self plans included, so a self-workout member's goal is the days they picked), or
 * DefaultWeeklyGoal when no plan has days. A day counts once however many workouts it has.
 * The streak is weeks in a row that met today's goal; this week only adds once it's met.
 */
export const DefaultWeeklyGoal = 3;

export function weeklyGoal(plans: Workout[], memberId: string) {
  const days = normaliseDays(plans.flatMap((p) => p.memberDays[memberId] ?? []));
  return days.length > 0 ? days.length : DefaultWeeklyGoal;
}

/** ISO weekdays (1 = Mon) of this week with at least one finished workout. */
export function daysTrainedThisWeek(logs: WorkoutLog[], now: Date = new Date()) {
  const start = startOfWeek(now).getTime();
  return normaliseDays(
    logs
      .map((l) => new Date(l.completedAt))
      .filter((d) => d.getTime() >= start && d.getTime() <= now.getTime())
      .map(isoWeekday),
  );
}

/** Weeks in a row with at least `goal` days trained, counting back from this week. */
export function goalStreak(logs: WorkoutLog[], goal: number, now: Date = new Date()) {
  const daysByWeek = new Map<number, Set<number>>();
  for (const log of logs) {
    const done = new Date(log.completedAt);
    const week = startOfWeek(done).getTime();
    const days = daysByWeek.get(week) ?? new Set<number>();
    days.add(isoWeekday(done));
    daysByWeek.set(week, days);
  }
  const met = (week: Date) => (daysByWeek.get(week.getTime())?.size ?? 0) >= goal;

  const week = startOfWeek(now);
  if (!met(week)) week.setDate(week.getDate() - 7);
  let streak = 0;
  while (met(week)) {
    streak += 1;
    week.setDate(week.getDate() - 7);
  }
  return streak;
}

export type WeeklyGoal = {
  goal: number;
  /** Days trained this week, at most 7. */
  done: number;
  /** 0 to 1, for the ring. */
  progress: number;
  /** ISO weekdays trained this week. */
  days: number[];
  streak: number;
};

export function weeklyGoalSummary(
  plans: Workout[],
  logs: WorkoutLog[],
  memberId: string,
  now: Date = new Date(),
): WeeklyGoal {
  const goal = weeklyGoal(plans, memberId);
  const days = daysTrainedThisWeek(logs, now);
  return {
    goal,
    done: days.length,
    progress: Math.min(days.length / goal, 1),
    days,
    streak: goalStreak(logs, goal, now),
  };
}

/** "2 more to go", "1 more to go" or "Goal reached". */
export function goalLine({ goal, done }: Pick<WeeklyGoal, 'goal' | 'done'>) {
  return done >= goal ? 'Goal reached' : `${goal - done} more to go`;
}
