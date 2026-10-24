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
  exercises: {
    position: number;
    sets: number;
    reps: number;
    target_weight_kg: number | null;
    rest_seconds: number;
    exercise: { id: string; name: string };
  }[];
};

function toWorkout(row: WorkoutRow): Workout {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    title: row.title,
    description: row.description,
    level: row.level,
    durationMinutes: row.duration_minutes,
    exercises: [...row.exercises]
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        exerciseId: e.exercise.id,
        name: e.exercise.name,
        sets: e.sets,
        reps: e.reps,
        targetWeightKg: e.target_weight_kg === null ? null : Number(e.target_weight_kg),
        restSeconds: e.rest_seconds,
      })),
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
    .select(
      'id, trainer_id, title, description, level, duration_minutes, exercises:workout_exercises(position, sets, reps, target_weight_kg, rest_seconds, exercise:exercises(id, name))',
    )
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false });
  if (filter.trainerId) query = query.eq('trainer_id', filter.trainerId);
  return (unwrap(await query) as unknown as WorkoutRow[]).map(toWorkout);
}
