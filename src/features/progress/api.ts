import type { WorkoutLog } from '@/features/progress/types';
import { delay, forGym, mockLogs } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type LogRow = {
  client_id: string;
  workout_id: string | null;
  title: string;
  started_at: string;
  completed_at: string;
  sets: {
    exercise_id: string;
    set_number: number;
    reps: number;
    weight_kg: number | null;
    exercise: { name: string };
  }[];
};

function toLog(row: LogRow): WorkoutLog {
  return {
    clientId: row.client_id,
    workoutId: row.workout_id,
    title: row.title,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    sets: row.sets
      .map((s) => ({
        exerciseId: s.exercise_id,
        exerciseName: s.exercise.name,
        setNumber: s.set_number,
        reps: s.reps,
        weightKg: s.weight_kg === null ? null : Number(s.weight_kg),
      }))
      .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.setNumber - b.setNumber),
  };
}

/** The member's completed workouts at this gym, newest first. */
export async function listLogs(gymId: string, memberId: string): Promise<WorkoutLog[]> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockLogs[memberId] ?? []).sort((a, b) =>
        b.completedAt.localeCompare(a.completedAt),
      ),
    );
  }
  const rows = unwrap(
    await supabase
      .from('workout_logs')
      .select(
        'client_id, workout_id, title, started_at, completed_at, sets:workout_log_sets(exercise_id, set_number, reps, weight_kg, exercise:exercises(name))',
      )
      .eq('gym_id', gymId)
      .eq('member_id', memberId)
      .order('completed_at', { ascending: false })
      .limit(100),
  ) as unknown as LogRow[];
  return rows.map(toLog);
}

/**
 * Uploads a finished workout. Safe to retry after a failure or while offline:
 * the log is keyed by its device-generated client id and each set by its
 * number, so repeats are ignored instead of duplicated.
 */
export async function saveLog(gymId: string, memberId: string, log: WorkoutLog) {
  if (!supabase) {
    const logs = (mockLogs[memberId] ??= []);
    if (!logs.some((l) => l.clientId === log.clientId)) logs.push(log);
    return delay(undefined);
  }
  const { error: logError } = await supabase.from('workout_logs').upsert(
    {
      client_id: log.clientId,
      gym_id: gymId,
      member_id: memberId,
      workout_id: log.workoutId,
      title: log.title,
      started_at: log.startedAt,
      completed_at: log.completedAt,
    },
    { onConflict: 'client_id', ignoreDuplicates: true },
  );
  if (logError) throw logError;

  const { id } = unwrap(
    await supabase.from('workout_logs').select('id').eq('client_id', log.clientId).single(),
  );
  const { error: setsError } = await supabase.from('workout_log_sets').upsert(
    log.sets.map((s) => ({
      log_id: id,
      exercise_id: s.exerciseId,
      set_number: s.setNumber,
      reps: s.reps,
      weight_kg: s.weightKg,
    })),
    { onConflict: 'log_id,exercise_id,set_number', ignoreDuplicates: true },
  );
  if (setsError) throw setsError;
}
