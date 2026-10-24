export type WorkoutLevel = 'beginner' | 'intermediate' | 'advanced';

export type Exercise = {
  name: string;
  sets: number;
  reps: number;
};

export type Workout = {
  id: string;
  trainerId: string;
  title: string;
  description: string;
  level: WorkoutLevel;
  durationMinutes: number;
  exercises: Exercise[];
};
