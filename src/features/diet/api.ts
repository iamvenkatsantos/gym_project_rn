import type { MealPlanInput } from '@/features/diet/plan-draft';
import type { MealPlan } from '@/features/diet/types';
import { delay, forGym, mockId, mockMealPlans, mockPeople } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type MealPlanRow = {
  id: string;
  coach_id: string;
  title: string;
  notes: string;
  food_type: MealPlan['foodType'];
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  updated_at: string;
  coach: { full_name: string } | null;
  meals: {
    position: number;
    name: string;
    time_label: string;
    foods: string;
    calories: number | null;
  }[];
  assignments: { member_id: string }[];
};

const PLAN_COLUMNS =
  'id, coach_id, title, notes, food_type, calories, protein_g, carbs_g, fat_g, updated_at, coach:profiles!meal_plans_coach_id_fkey(full_name), meals:meal_plan_meals(position, name, time_label, foods, calories), assignments:meal_plan_assignments(member_id)';

function toMealPlan(row: MealPlanRow): MealPlan {
  return {
    id: row.id,
    coachId: row.coach_id,
    coachName: row.coach?.full_name ?? 'Your trainer',
    title: row.title,
    notes: row.notes,
    foodType: row.food_type,
    targets: {
      calories: row.calories,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
    },
    meals: [...row.meals]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ name: m.name, time: m.time_label, foods: m.foods, calories: m.calories })),
    // RLS only returns the caller's own assignment to members.
    assignedMemberIds: row.assignments.map((a) => a.member_id),
    updatedAt: row.updated_at,
  };
}

/** A coach's diet plans, newest first. */
export async function listMealPlans(gymId: string, coachId: string): Promise<MealPlan[]> {
  if (!supabase) {
    return delay(forGym(gymId, mockMealPlans).filter((p) => p.coachId === coachId));
  }
  const rows = unwrap(
    await supabase
      .from('meal_plans')
      .select(PLAN_COLUMNS)
      .eq('gym_id', gymId)
      .eq('coach_id', coachId)
      .order('updated_at', { ascending: false }),
  ) as unknown as MealPlanRow[];
  return rows.map(toMealPlan);
}

/** The diet plan a member is on at this gym, or null. */
export async function getMemberMealPlan(gymId: string, memberId: string): Promise<MealPlan | null> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockMealPlans).find((p) => p.assignedMemberIds.includes(memberId)) ?? null,
    );
  }
  const { data, error } = await supabase
    .from('meal_plan_assignments')
    .select(`plan:meal_plans(${PLAN_COLUMNS})`)
    .eq('gym_id', gymId)
    .eq('member_id', memberId)
    .maybeSingle();
  if (error) throw error;
  const row = data as unknown as { plan: MealPlanRow | null } | null;
  return row?.plan ? toMealPlan(row.plan) : null;
}

/** Creates a plan (planId null) or replaces an existing one. Returns the plan's id. */
export async function saveMealPlan({
  gymId,
  coachId,
  planId,
  plan,
}: {
  gymId: string;
  coachId: string;
  planId: string | null;
  plan: MealPlanInput;
}): Promise<string> {
  if (!supabase) {
    const existing = mockMealPlans.find((p) => p.id === planId);
    const updatedAt = new Date().toISOString();
    if (existing) {
      Object.assign(existing, plan, { updatedAt });
      return delay(existing.id);
    }
    const id = mockId('mp');
    const coachName = mockPeople.find((p) => p.id === coachId)?.fullName ?? 'You';
    mockMealPlans.unshift({ id, coachId, coachName, assignedMemberIds: [], updatedAt, ...plan });
    return delay(id);
  }
  return unwrap(
    await supabase.rpc('save_meal_plan', {
      p_gym_id: gymId,
      p_plan_id: planId,
      p_title: plan.title,
      p_notes: plan.notes,
      p_food_type: plan.foodType,
      p_calories: plan.targets.calories,
      p_protein_g: plan.targets.proteinG,
      p_carbs_g: plan.targets.carbsG,
      p_fat_g: plan.targets.fatG,
      p_meals: plan.meals.map((m) => ({
        name: m.name,
        time_label: m.time,
        foods: m.foods,
        calories: m.calories,
      })),
    }),
  ) as string;
}

/** Deletes a plan; members on it are left without a diet plan. */
export async function deleteMealPlan(planId: string) {
  if (!supabase) {
    const index = mockMealPlans.findIndex((p) => p.id === planId);
    if (index >= 0) mockMealPlans.splice(index, 1);
    return delay(undefined);
  }
  const { error } = await supabase.from('meal_plans').delete().eq('id', planId);
  if (error) throw error;
}

/**
 * Puts a member on a plan or takes them off it. A member follows one diet plan at a time,
 * so assigning replaces the one they had.
 */
export async function setMealPlanAssignment(planId: string, memberId: string, assigned: boolean) {
  if (!supabase) {
    for (const plan of mockMealPlans) {
      plan.assignedMemberIds = plan.assignedMemberIds.filter((id) => id !== memberId);
      if (assigned && plan.id === planId) plan.assignedMemberIds.push(memberId);
    }
    return delay(undefined);
  }
  const { error } = await supabase.rpc(assigned ? 'assign_meal_plan' : 'unassign_meal_plan', {
    p_plan_id: planId,
    p_member_id: memberId,
  });
  if (error) throw error;
}
