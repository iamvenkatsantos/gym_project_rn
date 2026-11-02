import type { SelfPlan, SelfPrefs } from '@/features/self-workouts/types';
import type { PlanDraft } from '@/features/workouts/plan-draft';
import {
  delay,
  forGym,
  mockId,
  mockPeople,
  mockSelfPrefs,
  mockTrainerLinks,
  mockWorkouts,
} from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

const toExercises = (plan: Pick<PlanDraft, 'exercises'>) =>
  plan.exercises.map((e) => ({
    exercise_id: e.exerciseId,
    sets: e.sets,
    reps: e.reps,
    target_weight_kg: e.targetWeightKg,
    rest_seconds: e.restSeconds,
  }));

const nameOf = (id: string) => mockPeople.find((p) => p.id === id)?.fullName ?? 'Member';

/** A member's coach switches self workouts on or off for them. */
export async function setSelfWorkouts(
  gymId: string,
  memberId: string,
  trainerId: string,
  on: boolean,
) {
  if (!supabase) {
    const link = forGym(gymId, mockTrainerLinks).find(
      (l) => l.memberId === memberId && l.trainerId === trainerId,
    );
    if (!link) throw new Error('Only this member’s trainers can do this');
    link.selfWorkouts = on;
    return delay(undefined);
  }
  const { error } = await supabase.rpc('set_self_workouts', {
    p_gym_id: gymId,
    p_member_id: memberId,
    p_on: on,
  });
  if (error) throw error;
}

/** What the member last asked for, or null before they set up their plan. */
export async function getSelfPrefs(gymId: string, memberId: string): Promise<SelfPrefs | null> {
  if (!supabase) return delay(forGym(gymId, [mockSelfPrefs[memberId] ?? null])[0] ?? null);
  const row = unwrap(
    await supabase
      .from('self_workout_prefs')
      .select('goal, level, days, split')
      .eq('gym_id', gymId)
      .eq('member_id', memberId)
      .maybeSingle(),
  ) as SelfPrefs | null;
  return row;
}

/** Builds (or rebuilds) the member's week, replacing their own plans. */
export async function createSelfPlan(
  gymId: string,
  memberId: string,
  prefs: SelfPrefs,
  plans: SelfPlan[],
) {
  if (!supabase) {
    mockSelfPrefs[memberId] = prefs;
    for (let i = mockWorkouts.length - 1; i >= 0; i -= 1) {
      if (mockWorkouts[i].isSelf && mockWorkouts[i].trainerId === memberId) {
        mockWorkouts.splice(i, 1);
      }
    }
    for (const plan of plans) {
      const { days, ...fields } = plan;
      mockWorkouts.push({
        ...fields,
        id: mockId('w'),
        trainerId: memberId,
        trainerName: nameOf(memberId),
        isSelf: true,
        assignedMemberIds: [memberId],
        memberDays: { [memberId]: days },
      });
    }
    return delay(undefined);
  }
  const { error } = await supabase.rpc('create_self_plan', {
    p_gym_id: gymId,
    p_goal: prefs.goal,
    p_level: prefs.level,
    p_days: prefs.days,
    p_split: prefs.split,
    p_plans: plans.map((p) => ({
      title: p.title,
      description: p.description,
      level: p.level,
      duration_minutes: p.durationMinutes,
      days: p.days,
      exercises: toExercises(p),
    })),
  });
  if (error) throw error;
}

/**
 * Saves one of the member's own plans (new when workoutId is null). The member saves while
 * self workouts are on; their trainers can always edit. Returns the plan's id.
 */
export async function saveSelfWorkout({
  gymId,
  memberId,
  workoutId,
  plan,
  days,
}: {
  gymId: string;
  memberId: string;
  workoutId: string | null;
  plan: PlanDraft;
  days: number[];
}): Promise<string> {
  if (!supabase) {
    const fields = { ...plan, title: plan.title.trim() };
    const existing = mockWorkouts.find((w) => w.id === workoutId && w.isSelf);
    if (existing) {
      Object.assign(existing, fields, { memberDays: { [memberId]: days } });
      return delay(existing.id);
    }
    const id = mockId('w');
    mockWorkouts.push({
      ...fields,
      id,
      trainerId: memberId,
      trainerName: nameOf(memberId),
      isSelf: true,
      assignedMemberIds: [memberId],
      memberDays: { [memberId]: days },
    });
    return delay(id);
  }
  return unwrap(
    await supabase.rpc('save_self_workout', {
      p_gym_id: gymId,
      p_member_id: memberId,
      p_workout_id: workoutId,
      p_title: plan.title,
      p_description: plan.description,
      p_level: plan.level,
      p_duration_minutes: plan.durationMinutes,
      p_exercises: toExercises(plan),
      p_days: days,
    }),
  ) as string;
}

export async function deleteSelfWorkout(workoutId: string) {
  if (!supabase) {
    const index = mockWorkouts.findIndex((w) => w.id === workoutId && w.isSelf);
    if (index >= 0) mockWorkouts.splice(index, 1);
    return delay(undefined);
  }
  const { error } = await supabase.rpc('delete_self_workout', { p_workout_id: workoutId });
  if (error) throw error;
}
