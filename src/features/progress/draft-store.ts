import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { WorkoutLog } from '@/features/progress/types';
import type { Workout } from '@/features/workouts/types';

export type DraftSet = {
  reps: number;
  weightKg: number | null;
  done: boolean;
};

export type DraftExercise = {
  exerciseId: string;
  name: string;
  restSeconds: number;
  sets: DraftSet[];
};

export type WorkoutDraft = {
  clientId: string;
  gymId: string;
  workoutId: string | null;
  title: string;
  startedAt: string;
  exercises: DraftExercise[];
};

type DraftState = {
  draft: WorkoutDraft | null;
  /** When the current rest period ends (epoch ms), or null when not resting. */
  restUntil: number | null;
  start: (gymId: string, workout: Workout) => void;
  updateSet: (exercise: number, set: number, patch: Partial<Omit<DraftSet, 'done'>>) => void;
  toggleSet: (exercise: number, set: number) => void;
  addSet: (exercise: number) => void;
  skipRest: () => void;
  discard: () => void;
};

function mapSet(
  draft: WorkoutDraft,
  exerciseIndex: number,
  setIndex: number,
  fn: (s: DraftSet) => DraftSet,
): WorkoutDraft {
  return {
    ...draft,
    exercises: draft.exercises.map((e, i) =>
      i === exerciseIndex ? { ...e, sets: e.sets.map((s, j) => (j === setIndex ? fn(s) : s)) } : e,
    ),
  };
}

/**
 * The workout in progress. Persisted on the device so it survives the app
 * closing mid-workout or having no signal in the gym.
 */
export const useWorkoutDraft = create<DraftState>()(
  persist(
    (set, get) => ({
      draft: null,
      restUntil: null,
      start: (gymId, workout) =>
        set({
          restUntil: null,
          draft: {
            clientId: randomUUID(),
            gymId,
            workoutId: workout.id,
            title: workout.title,
            startedAt: new Date().toISOString(),
            exercises: workout.exercises.map((e) => ({
              exerciseId: e.exerciseId,
              name: e.name,
              restSeconds: e.restSeconds,
              sets: Array.from({ length: e.sets }, () => ({
                reps: e.reps,
                weightKg: e.targetWeightKg,
                done: false,
              })),
            })),
          },
        }),
      updateSet: (exercise, setIndex, patch) => {
        const { draft } = get();
        if (draft) set({ draft: mapSet(draft, exercise, setIndex, (s) => ({ ...s, ...patch })) });
      },
      toggleSet: (exercise, setIndex) => {
        const { draft } = get();
        if (!draft) return;
        const wasDone = draft.exercises[exercise].sets[setIndex].done;
        set({
          draft: mapSet(draft, exercise, setIndex, (s) => ({ ...s, done: !s.done })),
          restUntil: wasDone ? null : Date.now() + draft.exercises[exercise].restSeconds * 1000,
        });
      },
      addSet: (exercise) => {
        const { draft } = get();
        if (!draft) return;
        set({
          draft: {
            ...draft,
            exercises: draft.exercises.map((e, i) => {
              if (i !== exercise) return e;
              const last = e.sets[e.sets.length - 1];
              return {
                ...e,
                sets: [
                  ...e.sets,
                  { reps: last?.reps ?? 10, weightKg: last?.weightKg ?? null, done: false },
                ],
              };
            }),
          },
        });
      },
      skipRest: () => set({ restUntil: null }),
      discard: () => set({ draft: null, restUntil: null }),
    }),
    { name: 'corefit-workout-draft', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** The finished workout to upload: only completed sets, numbered per exercise. */
export function draftToLog(draft: WorkoutDraft, completedAt: Date = new Date()): WorkoutLog {
  return {
    clientId: draft.clientId,
    workoutId: draft.workoutId,
    title: draft.title,
    startedAt: draft.startedAt,
    completedAt: completedAt.toISOString(),
    sets: draft.exercises.flatMap((e) =>
      e.sets
        .filter((s) => s.done)
        .map((s, i) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.name,
          setNumber: i + 1,
          reps: s.reps,
          weightKg: s.weightKg,
        })),
    ),
  };
}
