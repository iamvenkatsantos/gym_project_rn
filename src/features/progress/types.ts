export type LoggedSet = {
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
};

export type WorkoutLog = {
  /** Generated on the device; makes re-uploading the same workout a no-op. */
  clientId: string;
  workoutId: string | null;
  title: string;
  startedAt: string;
  completedAt: string;
  sets: LoggedSet[];
};

export type PersonalRecord = {
  exerciseId: string;
  exerciseName: string;
  weightKg: number | null;
  reps: number;
  achievedAt: string;
};
