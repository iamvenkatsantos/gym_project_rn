import {
  addMeal,
  DietLimits,
  draftFromMealPlan,
  emptyMealPlan,
  macroCalories,
  mealPlanInput,
  mealPlanProblem,
  mealsCalories,
  moveMeal,
  removeMeal,
  updateMeal,
  type MealPlanDraft,
} from '@/features/diet/plan-draft';
import { otherPlanOf } from '@/features/diet/rules';
import type { MealPlan } from '@/features/diet/types';

const filled = (): MealPlanDraft => {
  let draft = { ...emptyMealPlan(), title: 'Lean bulk' };
  draft = updateMeal(draft, 0, { foods: 'Oats, banana', time: ' 7:30 AM ', calories: '450' });
  draft = updateMeal(draft, 1, { foods: 'Rice, dal' });
  draft = updateMeal(draft, 2, { foods: 'Roti, paneer' });
  return draft;
};

const plan: MealPlan = {
  id: 'mp-1',
  coachId: 'u-trainer',
  coachName: 'Tom Trainer',
  title: 'Lean bulk',
  notes: '',
  foodType: 'egg',
  targets: { calories: 2400, proteinG: 140, carbsG: null, fatG: 70 },
  meals: [
    { name: 'Breakfast', time: '7:30 AM', foods: 'Eggs', calories: 400 },
    { name: 'Lunch', time: '', foods: 'Rice', calories: null },
  ],
  assignedMemberIds: ['u-member'],
  updatedAt: '2026-10-26T10:00:00Z',
};

describe('diet plan draft', () => {
  it('starts with breakfast, lunch and dinner, and needs a name and foods', () => {
    const draft = emptyMealPlan();
    expect(draft.meals.map((m) => m.name)).toEqual(['Breakfast', 'Lunch', 'Dinner']);
    expect(mealPlanProblem(draft)).toBe('Enter a plan name.');
    expect(mealPlanProblem({ ...draft, title: 'Cut' })).toBe('Add what to eat for Breakfast.');
    expect(mealPlanProblem(filled())).toBeNull();
  });

  it('gives each meal its own key, even with the same name', () => {
    const draft = addMeal(addMeal(emptyMealPlan(), 'Snack'), 'Snack');
    expect(new Set(draft.meals.map((m) => m.key)).size).toBe(5);
  });

  it('stops adding meals at the limit', () => {
    let draft = emptyMealPlan();
    for (let i = 0; i < 20; i++) draft = addMeal(draft, 'Snack');
    expect(draft.meals).toHaveLength(DietLimits.meals);
  });

  it('moves and removes meals', () => {
    const draft = filled();
    expect(moveMeal(draft, 0, 1).meals.map((m) => m.name)).toEqual([
      'Lunch',
      'Breakfast',
      'Dinner',
    ]);
    expect(moveMeal(draft, 0, -1)).toBe(draft);
    expect(removeMeal(draft, 1).meals.map((m) => m.name)).toEqual(['Breakfast', 'Dinner']);
    expect(mealPlanProblem({ ...draft, meals: [] })).toBe('Add at least one meal.');
  });

  it('checks targets and meal calories against the database limits', () => {
    const draft = filled();
    expect(mealPlanProblem({ ...draft, targets: { ...draft.targets, calories: '500' } })).toBe(
      'Calories: Use 800 to 6000.',
    );
    expect(mealPlanProblem({ ...draft, targets: { ...draft.targets, proteinG: '12.5' } })).toBe(
      'Protein: Use a whole number.',
    );
    expect(mealPlanProblem(updateMeal(draft, 1, { calories: '9000' }))).toBe(
      'Calories for Lunch: Use 0 to 3000.',
    );
    expect(mealPlanProblem(updateMeal(draft, 1, { name: ' ' }))).toBe(
      'Name every meal, like Breakfast.',
    );
  });

  it('turns the draft into trimmed values and numbers, leaving blanks as null', () => {
    const input = mealPlanInput({
      ...filled(),
      title: ' Lean bulk ',
      targets: { calories: '2400', proteinG: '', carbsG: '300', fatG: '' },
    });
    expect(input.title).toBe('Lean bulk');
    expect(input.targets).toEqual({ calories: 2400, proteinG: null, carbsG: 300, fatG: null });
    expect(input.meals[0]).toEqual({
      name: 'Breakfast',
      time: '7:30 AM',
      foods: 'Oats, banana',
      calories: 450,
    });
    expect(input.meals[1].calories).toBeNull();
  });

  it('round-trips a saved plan', () => {
    const draft = draftFromMealPlan(plan);
    expect(draft.targets).toEqual({ calories: '2400', proteinG: '140', carbsG: '', fatG: '70' });
    expect(mealPlanInput(draft)).toEqual({
      title: plan.title,
      notes: plan.notes,
      foodType: plan.foodType,
      targets: plan.targets,
      meals: plan.meals,
    });
  });
});

describe('diet plan numbers', () => {
  it('adds up macro calories, or null when no macros are set', () => {
    expect(macroCalories(plan.targets)).toBe(140 * 4 + 70 * 9);
    expect(macroCalories({ calories: 2000, proteinG: null, carbsG: null, fatG: null })).toBeNull();
  });

  it('adds up the meals that have calories', () => {
    expect(mealsCalories(plan.meals)).toBe(400);
    expect(mealsCalories([plan.meals[1]])).toBeNull();
  });

  it("finds the coach's plan a member is on", () => {
    expect(otherPlanOf([plan], 'u-member')?.id).toBe('mp-1');
    expect(otherPlanOf([plan], 'u-member-2')).toBeNull();
  });
});
