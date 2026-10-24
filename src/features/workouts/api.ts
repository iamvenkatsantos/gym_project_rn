import type { Workout } from '@/features/workouts/types';
import { delay, forGym, mockWorkouts } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type WorkoutRow = {
  id: string;
  trainer_id: string;
  title: string;
  description: string;
  level: Workout['level'];
  duration_minutes: number;
  exercises: Workout['exercises'];
};

function toWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    title: row.title,
    description: row.description,
    level: row.level,
    durationMinutes: row.duration_minutes,
    exercises: row.exercises,
  };
}

export async function listWorkouts(
  gymId: string,
  filter: { trainerId?: string } = {},
): Promise<Workout[]> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockWorkouts).filter(
        (w) => !filter.trainerId || w.trainerId === filter.trainerId,
      ),
    );
  }
  let query = supabase
    .from('workouts')
    .select('id, trainer_id, title, description, level, duration_minutes, exercises')
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false });
  if (filter.trainerId) query = query.eq('trainer_id', filter.trainerId);
  return unwrap(await query).map(toWorkout);
}
