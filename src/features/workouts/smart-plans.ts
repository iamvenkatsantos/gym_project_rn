import { starterExercises } from '@/features/exercises/library';
import type { Exercise } from '@/features/exercises/types';
import type { PlanDraft } from '@/features/workouts/plan-draft';
import type { WorkoutLevel } from '@/features/workouts/types';

/**
 * Ready-made plans a coach copies, edits and assigns. They use the shared
 * exercise library only, so every gym has the exercises. Target weights are
 * left for the coach to set per member. Reps on held moves (plank) are seconds.
 */
export type SmartPlan = {
  id: string;
  title: string;
  description: string;
  level: WorkoutLevel;
  durationMinutes: number;
  /** A suggested week, e.g. Mon, Wed, Fri. */
  suggestedDays: number[];
  exercises: { libraryId: string; sets: number; reps: number; restSeconds: number }[];
};

const ex = (libraryId: string, sets: number, reps: number, restSeconds = 90) => ({
  libraryId,
  sets,
  reps,
  restSeconds,
});

export const smartPlans: SmartPlan[] = [
  // Beginner: learn the basic movements, machines and light dumbbells.
  {
    id: 'sp-beginner-full-body-a',
    title: 'Full body A',
    description: 'Squat, push, pull and core. Swap with Full body B.',
    level: 'beginner',
    durationMinutes: 40,
    suggestedDays: [1, 5],
    exercises: [
      ex('e-goblet-squat', 3, 12),
      ex('e-push-up', 3, 8, 60),
      ex('e-dumbbell-row', 3, 12),
      ex('e-glute-bridge', 3, 12, 60),
      ex('e-plank', 3, 30, 45),
    ],
  },
  {
    id: 'sp-beginner-full-body-b',
    title: 'Full body B',
    description: 'Machines for safe loading. Swap with Full body A.',
    level: 'beginner',
    durationMinutes: 40,
    suggestedDays: [3],
    exercises: [
      ex('e-leg-press', 3, 12),
      ex('e-machine-chest-press', 3, 12),
      ex('e-lat-pulldown', 3, 12),
      ex('e-step-up', 2, 10, 60),
      ex('e-dead-bug', 3, 10, 45),
    ],
  },
  {
    id: 'sp-beginner-machine-circuit',
    title: 'Machine circuit',
    description: 'One machine per muscle, short rests. Good for week one.',
    level: 'beginner',
    durationMinutes: 35,
    suggestedDays: [2, 4],
    exercises: [
      ex('e-leg-extension', 2, 15, 45),
      ex('e-seated-leg-curl', 2, 15, 45),
      ex('e-machine-shoulder-press', 2, 12, 45),
      ex('e-machine-row', 2, 12, 45),
      ex('e-pec-deck', 2, 12, 45),
      ex('e-hip-abduction', 2, 15, 45),
    ],
  },
  {
    id: 'sp-beginner-fat-loss',
    title: 'Bodyweight burner',
    description: 'No equipment, short rests to keep the heart rate up.',
    level: 'beginner',
    durationMinutes: 30,
    suggestedDays: [2, 6],
    exercises: [
      ex('e-bodyweight-squat', 3, 15, 30),
      ex('e-push-up', 3, 8, 30),
      ex('e-mountain-climber', 3, 20, 30),
      ex('e-walking-lunge', 3, 10, 30),
      ex('e-bicycle-crunch', 3, 16, 30),
    ],
  },
  {
    id: 'sp-beginner-core-posture',
    title: 'Core and posture',
    description: 'Back, glutes and core for desk-bound members.',
    level: 'beginner',
    durationMinutes: 30,
    suggestedDays: [4],
    exercises: [
      ex('e-face-pull', 3, 15, 45),
      ex('e-back-extension', 3, 12, 60),
      ex('e-glute-bridge', 3, 15, 45),
      ex('e-side-plank', 3, 20, 30),
      ex('e-pallof-press', 3, 10, 45),
    ],
  },

  // Intermediate: free weights, a split across the week.
  {
    id: 'sp-intermediate-push',
    title: 'Push day',
    description: 'Chest, shoulders and triceps.',
    level: 'intermediate',
    durationMinutes: 55,
    suggestedDays: [1, 4],
    exercises: [
      ex('e-bench-press', 4, 8, 120),
      ex('e-incline-dumbbell-press', 3, 10),
      ex('e-overhead-press', 3, 8, 120),
      ex('e-lateral-raise', 3, 15, 60),
      ex('e-triceps-pushdown', 3, 12, 60),
    ],
  },
  {
    id: 'sp-intermediate-pull',
    title: 'Pull day',
    description: 'Back, rear shoulders and biceps.',
    level: 'intermediate',
    durationMinutes: 55,
    suggestedDays: [2, 5],
    exercises: [
      ex('e-barbell-row', 4, 8, 120),
      ex('e-lat-pulldown', 3, 10),
      ex('e-seated-cable-row', 3, 12),
      ex('e-rear-delt-fly', 3, 15, 60),
      ex('e-hammer-curl', 3, 12, 60),
    ],
  },
  {
    id: 'sp-intermediate-legs',
    title: 'Leg day',
    description: 'Quads, hamstrings, glutes and calves.',
    level: 'intermediate',
    durationMinutes: 60,
    suggestedDays: [3, 6],
    exercises: [
      ex('e-back-squat', 4, 8, 150),
      ex('e-romanian-deadlift', 3, 10, 120),
      ex('e-split-squat', 3, 10),
      ex('e-lying-leg-curl', 3, 12, 60),
      ex('e-standing-calf-raise', 4, 15, 45),
    ],
  },
  {
    id: 'sp-intermediate-upper',
    title: 'Upper body',
    description: 'Push and pull in one session. Pair with Lower body.',
    level: 'intermediate',
    durationMinutes: 55,
    suggestedDays: [1, 4],
    exercises: [
      ex('e-dumbbell-bench-press', 4, 10),
      ex('e-pull-up', 4, 6, 120),
      ex('e-arnold-press', 3, 10),
      ex('e-dumbbell-row', 3, 12),
      ex('e-ez-bar-curl', 2, 12, 60),
      ex('e-skull-crusher', 2, 12, 60),
    ],
  },
  {
    id: 'sp-intermediate-lower',
    title: 'Lower body',
    description: 'Strength and glutes. Pair with Upper body.',
    level: 'intermediate',
    durationMinutes: 55,
    suggestedDays: [2, 5],
    exercises: [
      ex('e-front-squat', 4, 8, 150),
      ex('e-hip-thrust', 4, 10, 120),
      ex('e-dumbbell-lunge', 3, 10),
      ex('e-seated-leg-curl', 3, 12, 60),
      ex('e-hanging-leg-raise', 3, 10, 60),
    ],
  },

  // Advanced: heavy compounds, more volume, power work.
  {
    id: 'sp-advanced-heavy-lower',
    title: 'Heavy lower',
    description: 'Low reps, long rests. Warm up well first.',
    level: 'advanced',
    durationMinutes: 75,
    suggestedDays: [1],
    exercises: [
      ex('e-back-squat', 5, 5, 180),
      ex('e-deadlift', 3, 5, 180),
      ex('e-hack-squat', 3, 10, 120),
      ex('e-good-morning', 3, 8, 120),
      ex('e-seated-calf-raise', 4, 12, 60),
    ],
  },
  {
    id: 'sp-advanced-heavy-upper',
    title: 'Heavy upper',
    description: 'Strength for bench, row and press.',
    level: 'advanced',
    durationMinutes: 75,
    suggestedDays: [2],
    exercises: [
      ex('e-bench-press', 5, 5, 180),
      ex('e-barbell-row', 5, 5, 150),
      ex('e-military-press', 4, 6, 150),
      ex('e-chin-up', 4, 8, 120),
      ex('e-chest-dip', 3, 10, 90),
    ],
  },
  {
    id: 'sp-advanced-power',
    title: 'Power and conditioning',
    description: 'Explosive lifts, then a hard finisher.',
    level: 'advanced',
    durationMinutes: 60,
    suggestedDays: [4],
    exercises: [
      ex('e-power-clean', 5, 3, 150),
      ex('e-box-jump', 4, 5, 90),
      ex('e-kettlebell-swing', 4, 15, 60),
      ex('e-kettlebell-thruster', 3, 10, 60),
      ex('e-ab-wheel-rollout', 3, 10, 60),
    ],
  },
  {
    id: 'sp-advanced-chest-back',
    title: 'Chest and back volume',
    description: 'Muscle building, supersets welcome.',
    level: 'advanced',
    durationMinutes: 70,
    suggestedDays: [5],
    exercises: [
      ex('e-incline-bench-press', 4, 8, 120),
      ex('e-t-bar-row', 4, 8, 120),
      ex('e-cable-crossover', 3, 12, 60),
      ex('e-close-grip-pulldown', 3, 12, 60),
      ex('e-dumbbell-pullover', 3, 12, 60),
      ex('e-straight-arm-pulldown', 3, 15, 60),
    ],
  },
  {
    id: 'sp-advanced-shoulders-arms',
    title: 'Shoulders and arms',
    description: 'High volume for delts, biceps and triceps.',
    level: 'advanced',
    durationMinutes: 60,
    suggestedDays: [6],
    exercises: [
      ex('e-military-press', 4, 8, 120),
      ex('e-lateral-raise', 4, 15, 45),
      ex('e-reverse-pec-deck', 3, 15, 45),
      ex('e-barbell-curl', 4, 10, 60),
      ex('e-close-grip-bench-press', 4, 8, 90),
      ex('e-incline-dumbbell-curl', 3, 12, 60),
      ex('e-overhead-cable-extension', 3, 12, 60),
    ],
  },
];

export function smartPlansFor(level: WorkoutLevel) {
  return smartPlans.filter((p) => p.level === level);
}

const libraryName = (libraryId: string) => starterExercises.find((e) => e.id === libraryId)?.name;

/** The plan's exercise names, for showing a template before it's copied. */
export function smartPlanExerciseNames(plan: SmartPlan) {
  return plan.exercises.map((e) => libraryName(e.libraryId) ?? e.libraryId);
}

/**
 * A new plan draft from a smart plan, matched to the gym's exercises by id
 * (demo) or by name (the database has its own ids). Missing ones are skipped.
 */
export function draftFromSmartPlan(plan: SmartPlan, exercises: readonly Exercise[]): PlanDraft {
  const byName = new Map(exercises.map((e) => [e.name.toLowerCase(), e]));
  return {
    title: plan.title,
    description: plan.description,
    level: plan.level,
    durationMinutes: plan.durationMinutes,
    exercises: plan.exercises.flatMap((item) => {
      const name = libraryName(item.libraryId);
      const match =
        exercises.find((e) => e.id === item.libraryId) ??
        (name ? byName.get(name.toLowerCase()) : undefined);
      if (!match) return [];
      return [
        {
          exerciseId: match.id,
          name: match.name,
          sets: item.sets,
          reps: item.reps,
          targetWeightKg: null,
          restSeconds: item.restSeconds,
        },
      ];
    }),
  };
}
