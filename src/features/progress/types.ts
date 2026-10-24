import type { Role } from '@/features/auth/types';

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

/** Someone else's workout, as their trainer, supervisor or owner sees it in the history feed. */
export type GymWorkoutLog = WorkoutLog & {
  personId: string;
  personName: string;
  personRole: Role;
};

export type PersonalRecord = {
  exerciseId: string;
  exerciseName: string;
  weightKg: number | null;
  reps: number;
  achievedAt: string;
};
