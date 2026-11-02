import type { Role } from '@/features/auth/types';

export type LoggedSet = {
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weightKg: number | null;
};

/** How a member says the workout went, answered when they finish it. */
export type SelfCheck = {
  /** 1 (easy) to 10 (all-out). */
  effort: number | null;
  /** Where it hurt, or null for no pain. */
  pain: string | null;
  note: string | null;
};

/** A trainer's one reply to a member's workout. */
export type CoachReply = {
  text: string;
  byName: string | null;
  at: string;
};

export type WorkoutLog = {
  /** Generated on the device; makes re-uploading the same workout a no-op. */
  clientId: string;
  workoutId: string | null;
  title: string;
  startedAt: string;
  completedAt: string;
  sets: LoggedSet[];
  /** The member's self-check, if they answered one. */
  selfCheck?: SelfCheck | null;
  /** Exercises swapped mid-workout, e.g. "Lat pulldown → Dumbbell row". */
  swaps?: string[];
  reply?: CoachReply | null;
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
