export type WorkoutLevel = 'beginner' | 'intermediate' | 'advanced';

/** One exercise in a plan, with its prescription. */
export type PlanExercise = {
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  targetWeightKg: number | null;
  restSeconds: number;
};

export type Workout = {
  id: string;
  trainerId: string;
  title: string;
  description: string;
  level: WorkoutLevel;
  durationMinutes: number;
  exercises: PlanExercise[];
};
