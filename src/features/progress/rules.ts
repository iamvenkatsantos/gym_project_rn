import type { Role } from '@/features/auth/types';
import type { TrainerLink } from '@/features/coaching/types';
import type { GymWorkoutLog, PersonalRecord, WorkoutLog } from '@/features/progress/types';

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

type Person = { id: string; role: Role };

/**
 * Who may read whose workouts at a gym, mirroring can_view_workout_logs in the
 * database: owners see everyone, supervisors see trainers and members,
 * trainers see the members mapped to them, and everyone sees their own.
 */
export function canViewWorkoutsOf(viewer: Person, person: Person, links: TrainerLink[]) {
  if (viewer.id === person.id || viewer.role === 'owner') return true;
  if (viewer.role === 'supervisor') return person.role === 'member' || person.role === 'trainer';
  if (viewer.role === 'trainer') {
    return links.some((l) => l.trainerId === viewer.id && l.memberId === person.id);
  }
  return false;
}

/** Names of a member's trainers, alphabetically. */
export function trainerNamesOf(memberId: string, links: TrainerLink[]) {
  return links
    .filter((l) => l.memberId === memberId)
    .map((l) => l.trainerName)
    .sort((a, b) => a.localeCompare(b));
}

export type TrainerGroup = {
  /** A trainer's id, or 'unassigned' for members without one, or 'staff' for staff workouts. */
  key: string;
  title: string;
  logs: GymWorkoutLog[];
};

/**
 * Members' workouts under each of their trainers, alphabetically, then members
 * without a trainer, then staff. A member with two trainers shows under both.
 */
export function groupByTrainer(logs: GymWorkoutLog[], links: TrainerLink[]): TrainerGroup[] {
  const trainers = new Map<string, TrainerGroup>();
  const unassigned: TrainerGroup = { key: 'unassigned', title: 'No trainer yet', logs: [] };
  const staff: TrainerGroup = { key: 'staff', title: 'Staff', logs: [] };

  for (const log of logs) {
    if (log.personRole !== 'member') {
      staff.logs.push(log);
      continue;
    }
    const mine = links.filter((l) => l.memberId === log.personId);
    if (mine.length === 0) unassigned.logs.push(log);
    for (const link of mine) {
      const group = trainers.get(link.trainerId) ?? {
        key: link.trainerId,
        title: link.trainerName,
        logs: [],
      };
      group.logs.push(log);
      trainers.set(link.trainerId, group);
    }
  }

  return [
    ...[...trainers.values()].sort((a, b) => a.title.localeCompare(b.title)),
    unassigned,
    staff,
  ].filter((g) => g.logs.length > 0);
}
