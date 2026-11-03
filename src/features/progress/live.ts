import type { DraftExercise, WorkoutDraft } from '@/features/progress/draft-store';

/**
 * Live workout: the session runs one exercise at a time, one set at a time,
 * with a full rest screen between sets. These helpers pick what comes next.
 */

export type SetRef = { exercise: number; set: number };

/** The first set not done in an exercise, or null when all are done. */
export function nextSetIn(exercise: DraftExercise): number | null {
  const i = exercise.sets.findIndex((s) => !s.done);
  return i === -1 ? null : i;
}

/**
 * The next set to do: the rest of this exercise first, then the exercises after it,
 * then any skipped before it. Null once every set is done.
 */
export function nextSet(draft: WorkoutDraft, from: number): SetRef | null {
  const count = draft.exercises.length;
  for (let step = 0; step < count; step += 1) {
    const exercise = (from + step) % count;
    const set = nextSetIn(draft.exercises[exercise]);
    if (set !== null) return { exercise, set };
  }
  return null;
}

/** Sets done and planned across the workout. */
export function setCounts(draft: WorkoutDraft) {
  let done = 0;
  let total = 0;
  for (const e of draft.exercises) {
    total += e.sets.length;
    done += e.sets.filter((s) => s.done).length;
  }
  return { done, total };
}

/** True when every set of the exercise is done. */
export function exerciseDone(exercise: DraftExercise) {
  return exercise.sets.length > 0 && exercise.sets.every((s) => s.done);
}

/** Kilograms moved in the sets done so far. */
export function draftVolumeKg(draft: WorkoutDraft) {
  return draft.exercises.reduce(
    (sum, e) =>
      sum + e.sets.reduce((s, set) => s + (set.done ? set.reps * (set.weightKg ?? 0) : 0), 0),
    0,
  );
}

/** "12 reps · 20 kg", or "12 reps · Bodyweight". */
export function setTarget(set: { reps: number; weightKg: number | null }) {
  return `${set.reps} reps · ${set.weightKg === null ? 'Bodyweight' : `${set.weightKg} kg`}`;
}

/** Weight steps: 2.5 kg, the smallest plate pair most gyms have. */
export const WEIGHT_STEP = 2.5;
/** Seconds added by "+15 s" on the rest screen. */
export const REST_STEP = 15;
