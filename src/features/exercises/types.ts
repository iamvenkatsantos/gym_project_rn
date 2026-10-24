export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export type Exercise = {
  id: string;
  name: string;
  muscleGroups: string[];
  equipment: string;
  difficulty: Difficulty;
  instructions: string[];
  safetyTips: string[];
  imageUrl: string | null;
  videoUrl: string | null;
};

export type ExerciseFilter = {
  query: string;
  muscleGroup: string | null;
  equipment: string | null;
  difficulty: Difficulty | null;
};
