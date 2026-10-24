import { starterExercises } from '@/features/exercises/library';
import type { Exercise } from '@/features/exercises/types';
import { delay } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type ExerciseRow = {
  id: string;
  name: string;
  muscle_groups: string[];
  equipment: string;
  difficulty: Exercise['difficulty'];
  instructions: string[];
  safety_tips: string[];
  image_url: string | null;
  video_url: string | null;
};

const COLUMNS =
  'id, name, muscle_groups, equipment, difficulty, instructions, safety_tips, image_url, video_url';

function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    muscleGroups: row.muscle_groups,
    equipment: row.equipment,
    difficulty: row.difficulty,
    instructions: row.instructions,
    safetyTips: row.safety_tips,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
  };
}

/** The shared library plus the gym's own exercises. */
export async function listExercises(gymId: string): Promise<Exercise[]> {
  if (!supabase) return delay(starterExercises);
  const rows = unwrap(
    await supabase
      .from('exercises')
      .select(COLUMNS)
      .or(`gym_id.is.null,gym_id.eq.${gymId}`)
      .order('name'),
  ) as ExerciseRow[];
  return rows.map(toExercise);
}
