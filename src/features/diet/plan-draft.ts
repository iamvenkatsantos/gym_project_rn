import type { FoodType, Meal, MealPlan } from '@/features/diet/types';
import { firstError, validateOptionalText, validateTitle } from '@/lib/validation';

/** A meal being edited. Calories stay as typed until the plan is saved. */
export type MealDraft = {
  /** Stable list key, since two meals can share a name. */
  key: string;
  name: string;
  time: string;
  foods: string;
  calories: string;
};

export type TargetKey = 'calories' | 'proteinG' | 'carbsG' | 'fatG';

/** A diet plan being built or edited, before it's saved. Numbers stay as typed. */
export type MealPlanDraft = {
  title: string;
  notes: string;
  foodType: FoodType;
  targets: Record<TargetKey, string>;
  meals: MealDraft[];
};

/** What save_meal_plan takes. */
export type MealPlanInput = Pick<MealPlan, 'title' | 'notes' | 'foodType' | 'targets' | 'meals'>;

/** The same bounds the database enforces. */
export const DietLimits = {
  calories: { min: 800, max: 6000 },
  proteinG: { min: 0, max: 500 },
  carbsG: { min: 0, max: 1000 },
  fatG: { min: 0, max: 300 },
  mealCalories: { min: 0, max: 3000 },
  mealName: 40,
  mealTime: 30,
  foods: 500,
  notes: 1000,
  meals: 10,
} as const;

export const targetFields: { key: TargetKey; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'proteinG', label: 'Protein', unit: 'g' },
  { key: 'carbsG', label: 'Carbs', unit: 'g' },
  { key: 'fatG', label: 'Fat', unit: 'g' },
];

export const foodTypes: { value: FoodType; label: string }[] = [
  { value: 'veg', label: 'Veg' },
  { value: 'egg', label: 'Egg' },
  { value: 'non_veg', label: 'Non-veg' },
  { value: 'vegan', label: 'Vegan' },
];

export function foodTypeLabel(type: FoodType) {
  return foodTypes.find((t) => t.value === type)!.label;
}

/** Meals a coach can add with one tap. */
export const mealPresets = [
  'Breakfast',
  'Mid-morning',
  'Lunch',
  'Evening snack',
  'Dinner',
  'Pre-workout',
  'Post-workout',
] as const;

let nextKey = 0;
function meal(name = '', time = '', foods = '', calories = ''): MealDraft {
  nextKey += 1;
  return { key: `meal-${nextKey}`, name, time, foods, calories };
}

const numberText = (n: number | null) => (n === null ? '' : String(n));

export function emptyMealPlan(): MealPlanDraft {
  return {
    title: '',
    notes: '',
    foodType: 'veg',
    targets: { calories: '', proteinG: '', carbsG: '', fatG: '' },
    meals: [meal('Breakfast'), meal('Lunch'), meal('Dinner')],
  };
}

export function draftFromMealPlan(plan: MealPlan): MealPlanDraft {
  return {
    title: plan.title,
    notes: plan.notes,
    foodType: plan.foodType,
    targets: {
      calories: numberText(plan.targets.calories),
      proteinG: numberText(plan.targets.proteinG),
      carbsG: numberText(plan.targets.carbsG),
      fatG: numberText(plan.targets.fatG),
    },
    meals: plan.meals.map((m) => meal(m.name, m.time, m.foods, numberText(m.calories))),
  };
}

export function addMeal(draft: MealPlanDraft, name = ''): MealPlanDraft {
  if (draft.meals.length >= DietLimits.meals) return draft;
  return { ...draft, meals: [...draft.meals, meal(name)] };
}

export function removeMeal(draft: MealPlanDraft, index: number): MealPlanDraft {
  return { ...draft, meals: draft.meals.filter((_, i) => i !== index) };
}

/** Moves a meal up (-1) or down (+1); does nothing at either end. */
export function moveMeal(draft: MealPlanDraft, index: number, by: -1 | 1): MealPlanDraft {
  const target = index + by;
  if (target < 0 || target >= draft.meals.length) return draft;
  const meals = [...draft.meals];
  [meals[index], meals[target]] = [meals[target], meals[index]];
  return { ...draft, meals };
}

export function updateMeal(
  draft: MealPlanDraft,
  index: number,
  patch: Partial<Omit<MealDraft, 'key'>>,
): MealPlanDraft {
  return { ...draft, meals: draft.meals.map((m, i) => (i === index ? { ...m, ...patch } : m)) };
}

/** An optional whole number in a range: empty is fine. */
export function numberProblem(text: string, { min, max }: { min: number; max: number }) {
  const value = text.trim();
  if (!value) return null;
  if (!/^\d+$/.test(value)) return 'Use a whole number.';
  const n = Number(value);
  return n < min || n > max ? `Use ${min} to ${max}.` : null;
}

export function targetProblem(draft: MealPlanDraft, key: TargetKey) {
  return numberProblem(draft.targets[key], DietLimits[key]);
}

export function mealProblem(m: MealDraft): string | null {
  const name = m.name.trim() || 'this meal';
  if (!m.name.trim()) return 'Name every meal, like Breakfast.';
  if (m.name.trim().length > DietLimits.mealName)
    return `Keep meal names under ${DietLimits.mealName} characters.`;
  if (m.time.trim().length > DietLimits.mealTime)
    return `Keep the time for ${name} under ${DietLimits.mealTime} characters.`;
  if (!m.foods.trim()) return `Add what to eat for ${name}.`;
  if (m.foods.trim().length > DietLimits.foods)
    return `Keep the foods for ${name} under ${DietLimits.foods} characters.`;
  const calories = numberProblem(m.calories, DietLimits.mealCalories);
  return calories ? `Calories for ${name}: ${calories}` : null;
}

/** Why the plan can't be saved yet, or null when it can. */
export function mealPlanProblem(draft: MealPlanDraft): string | null {
  return firstError(
    validateTitle(draft.title, { label: 'plan name' }),
    validateOptionalText(draft.notes, DietLimits.notes),
    ...targetFields.map((f) => {
      const problem = targetProblem(draft, f.key);
      return problem ? `${f.label}: ${problem}` : null;
    }),
    draft.meals.length === 0 ? 'Add at least one meal.' : null,
    ...draft.meals.map(mealProblem),
  );
}

const toNumber = (text: string) => (text.trim() ? Number(text.trim()) : null);

/** The draft as the database takes it. Only call once mealPlanProblem is null. */
export function mealPlanInput(draft: MealPlanDraft): MealPlanInput {
  return {
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    foodType: draft.foodType,
    targets: {
      calories: toNumber(draft.targets.calories),
      proteinG: toNumber(draft.targets.proteinG),
      carbsG: toNumber(draft.targets.carbsG),
      fatG: toNumber(draft.targets.fatG),
    },
    meals: draft.meals.map((m): Meal => ({
      name: m.name.trim(),
      time: m.time.trim(),
      foods: m.foods.trim(),
      calories: toNumber(m.calories),
    })),
  };
}

/** Calories from the macros (4 kcal/g protein and carbs, 9 kcal/g fat), or null if none are set. */
export function macroCalories(targets: MealPlan['targets']) {
  const { proteinG, carbsG, fatG } = targets;
  if (proteinG === null && carbsG === null && fatG === null) return null;
  return (proteinG ?? 0) * 4 + (carbsG ?? 0) * 4 + (fatG ?? 0) * 9;
}

/** The meals' calories added up, or null when no meal has any. */
export function mealsCalories(meals: Meal[]) {
  const known = meals.filter((m) => m.calories !== null);
  return known.length ? known.reduce((sum, m) => sum + m.calories!, 0) : null;
}
