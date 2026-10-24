import type { PlanExercise, Workout, WorkoutLevel } from '@/features/workouts/types';

/** A plan being built or edited, before it's saved. */
export type PlanDraft = {
  title: string;
  description: string;
  level: WorkoutLevel;
  durationMinutes: number;
  exercises: PlanExercise[];
};

/** The same bounds the database enforces. */
export const PlanLimits = {
  durationMinutes: { min: 5, max: 300 },
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  targetWeightKg: { min: 0, max: 500 },
  restSeconds: { min: 0, max: 600 },
} as const;

const clamp = (value: number, { min, max }: { min: number; max: number }) =>
  Math.min(max, Math.max(min, value));

export function emptyPlan(): PlanDraft {
  return { title: '', description: '', level: 'beginner', durationMinutes: 45, exercises: [] };
}

export function planFromWorkout(workout: Workout): PlanDraft {
  return {
    title: workout.title,
    description: workout.description,
    level: workout.level,
    durationMinutes: workout.durationMinutes,
    exercises: workout.exercises.map((e) => ({ ...e })),
  };
}

/** Adds an exercise with a sensible starting prescription. Each exercise appears once per plan. */
export function addExercise(draft: PlanDraft, exercise: { id: string; name: string }): PlanDraft {
  if (draft.exercises.some((e) => e.exerciseId === exercise.id)) return draft;
  return {
    ...draft,
    exercises: [
      ...draft.exercises,
      {
        exerciseId: exercise.id,
        name: exercise.name,
        sets: 3,
        reps: 10,
        targetWeightKg: null,
        restSeconds: 90,
      },
    ],
  };
}

export function removeExercise(draft: PlanDraft, index: number): PlanDraft {
  return { ...draft, exercises: draft.exercises.filter((_, i) => i !== index) };
}

/** Moves an exercise up (-1) or down (+1); does nothing at either end. */
export function moveExercise(draft: PlanDraft, index: number, by: -1 | 1): PlanDraft {
  const target = index + by;
  if (target < 0 || target >= draft.exercises.length) return draft;
  const exercises = [...draft.exercises];
  [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
  return { ...draft, exercises };
}

/** Updates one exercise's prescription, keeping every value inside the database's limits. */
export function updateExercise(
  draft: PlanDraft,
  index: number,
  patch: Partial<Pick<PlanExercise, 'sets' | 'reps' | 'targetWeightKg' | 'restSeconds'>>,
): PlanDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((e, i) => {
      if (i !== index) return e;
      const next = { ...e, ...patch };
      const weight =
        next.targetWeightKg === null ? 0 : clamp(next.targetWeightKg, PlanLimits.targetWeightKg);
      return {
        ...next,
        sets: clamp(next.sets, PlanLimits.sets),
        reps: clamp(next.reps, PlanLimits.reps),
        restSeconds: clamp(next.restSeconds, PlanLimits.restSeconds),
        // 0 kg means bodyweight.
        targetWeightKg: weight === 0 ? null : weight,
      };
    }),
  };
}

export function setDuration(draft: PlanDraft, minutes: number): PlanDraft {
  return { ...draft, durationMinutes: clamp(minutes, PlanLimits.durationMinutes) };
}

/** Why the plan can't be saved yet, or null when it can. */
export function planProblem(draft: PlanDraft): string | null {
  if (!draft.title.trim()) return 'Give the plan a name.';
  if (draft.exercises.length === 0) return 'Add at least one exercise.';
  return null;
}
