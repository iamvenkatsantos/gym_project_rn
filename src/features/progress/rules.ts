import type { PersonalRecord, WorkoutLog } from '@/features/progress/types';

/** Local midnight on the Monday of the date's week. */
export function startOfWeek(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function workoutsThisWeek(logs: WorkoutLog[], now: Date = new Date()) {
  const start = startOfWeek(now).getTime();
  return logs.filter((l) => new Date(l.completedAt).getTime() >= start).length;
}

/**
 * Consecutive weeks with at least one workout, counting back from this week.
 * An empty current week doesn't break the streak until it's over.
 */
export function weekStreak(logs: WorkoutLog[], now: Date = new Date()) {
  const weeks = new Set(logs.map((l) => startOfWeek(new Date(l.completedAt)).getTime()));
  const week = startOfWeek(now);
  if (!weeks.has(week.getTime())) week.setDate(week.getDate() - 7);
  let streak = 0;
  while (weeks.has(week.getTime())) {
    streak += 1;
    week.setDate(week.getDate() - 7);
  }
  return streak;
}

/** Total kilograms moved: reps × weight over weighted sets. */
export function volumeKg(log: WorkoutLog) {
  return log.sets.reduce((sum, s) => sum + s.reps * (s.weightKg ?? 0), 0);
}

export function durationMinutes(log: WorkoutLog) {
  return Math.max(
    1,
    Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 60000),
  );
}

/** Best set per exercise: heaviest weight, then most reps; bodyweight moves go by reps. */
export function personalRecords(logs: WorkoutLog[]): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();
  for (const log of logs) {
    for (const set of log.sets) {
      const current = best.get(set.exerciseId);
      const better =
        !current ||
        (set.weightKg ?? 0) > (current.weightKg ?? 0) ||
        ((set.weightKg ?? 0) === (current.weightKg ?? 0) && set.reps > current.reps);
      if (better) {
        best.set(set.exerciseId, {
          exerciseId: set.exerciseId,
          exerciseName: set.exerciseName,
          weightKg: set.weightKg,
          reps: set.reps,
          achievedAt: log.completedAt,
        });
      }
    }
  }
  return [...best.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}
