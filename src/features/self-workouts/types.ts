import type { PlanExercise, WorkoutLevel } from '@/features/workouts/types';

export type SelfGoal = 'gain_muscle' | 'lose_weight' | 'stay_fit';

/** Whole body each session, or one area a day. */
export type SelfSplit = 'full_body' | 'split';

/** What a member asks for when their trainer lets them plan their own workouts. */
export type SelfPrefs = {
  goal: SelfGoal;
  level: WorkoutLevel;
  /** ISO weekdays, 3 to 6 of them. */
  days: number[];
  split: SelfSplit;
};

/** One plan of the member's week, ready to save. */
export type SelfPlan = {
  title: string;
  description: string;
  level: WorkoutLevel;
  durationMinutes: number;
  days: number[];
  exercises: PlanExercise[];
};
