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
  /** The coach who wrote the plan. */
  trainerName?: string;
  title: string;
  description: string;
  level: WorkoutLevel;
  durationMinutes: number;
  exercises: PlanExercise[];
  /** Members this plan is assigned to. Members only ever see their own id here. */
  assignedMemberIds: string[];
};
