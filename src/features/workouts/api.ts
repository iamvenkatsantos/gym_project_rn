import type { PlanDraft } from '@/features/workouts/plan-draft';
import type { Workout } from '@/features/workouts/types';
import { delay, forGym, mockId, mockWorkouts } from '@/lib/mock-db';
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
  assignments: { member_id: string }[];
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
    // RLS only returns the caller's own assignment to members, and all of them to the plan's author.
    assignedMemberIds: row.assignments.map((a) => a.member_id),
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
      'id, trainer_id, title, description, level, duration_minutes, exercises:workout_exercises(position, sets, reps, target_weight_kg, rest_seconds, exercise:exercises(id, name)), assignments:workout_assignments(member_id)',
    )
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false });
  if (filter.trainerId) query = query.eq('trainer_id', filter.trainerId);
  return (unwrap(await query) as unknown as WorkoutRow[]).map(toWorkout);
}

/** Creates a plan (workoutId null) or replaces an existing one. Returns the plan's id. */
export async function saveWorkout({
  gymId,
  trainerId,
  workoutId,
  plan,
}: {
  gymId: string;
  trainerId: string;
  workoutId: string | null;
  plan: PlanDraft;
}): Promise<string> {
  if (!supabase) {
    const fields = { ...plan, title: plan.title.trim(), exercises: plan.exercises };
    const existing = mockWorkouts.find((w) => w.id === workoutId);
    if (existing) {
      Object.assign(existing, fields);
      return delay(existing.id);
    }
    const id = mockId('w');
    mockWorkouts.unshift({ id, trainerId, assignedMemberIds: [], ...fields });
    return delay(id);
  }
  return unwrap(
    await supabase.rpc('save_workout', {
      p_gym_id: gymId,
      p_workout_id: workoutId,
      p_title: plan.title,
      p_description: plan.description,
      p_level: plan.level,
      p_duration_minutes: plan.durationMinutes,
      p_exercises: plan.exercises.map((e) => ({
        exercise_id: e.exerciseId,
        sets: e.sets,
        reps: e.reps,
        target_weight_kg: e.targetWeightKg,
        rest_seconds: e.restSeconds,
      })),
    }),
  ) as string;
}

/** Deletes a plan. Past workout logs keep their history but lose the link to it. */
export async function deleteWorkout(workoutId: string) {
  if (!supabase) {
    const index = mockWorkouts.findIndex((w) => w.id === workoutId);
    if (index >= 0) mockWorkouts.splice(index, 1);
    return delay(undefined);
  }
  const { error } = await supabase.from('workouts').delete().eq('id', workoutId);
  if (error) throw error;
}

export async function setAssignment(workoutId: string, memberId: string, assigned: boolean) {
  if (!supabase) {
    const workout = mockWorkouts.find((w) => w.id === workoutId);
    if (workout) {
      workout.assignedMemberIds = assigned
        ? [...new Set([...workout.assignedMemberIds, memberId])]
        : workout.assignedMemberIds.filter((id) => id !== memberId);
    }
    return delay(undefined);
  }
  const { error } = assigned
    ? await supabase
        .from('workout_assignments')
        .upsert(
          { workout_id: workoutId, member_id: memberId },
          { onConflict: 'workout_id,member_id', ignoreDuplicates: true },
        )
    : await supabase
        .from('workout_assignments')
        .delete()
        .eq('workout_id', workoutId)
        .eq('member_id', memberId);
  if (error) throw error;
}
