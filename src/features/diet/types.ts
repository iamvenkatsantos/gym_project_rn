/** What the plan's foods are: vegetarian, vegetarian with eggs, non-vegetarian or vegan. */
export type FoodType = 'veg' | 'egg' | 'non_veg' | 'vegan';

/** One meal of the day, e.g. "Breakfast · 7:30 AM: Oats, banana, milk". */
export type Meal = {
  name: string;
  /** Free text such as "7:30 AM" or "After workout"; empty when the coach leaves it open. */
  time: string;
  foods: string;
  calories: number | null;
};

/** Daily targets; null when the coach leaves one open. */
export type DietTargets = {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export type MealPlan = {
  id: string;
  coachId: string;
  coachName: string;
  title: string;
  notes: string;
  foodType: FoodType;
  targets: DietTargets;
  meals: Meal[];
  /** Members on this plan. Members only ever see their own id here. */
  assignedMemberIds: string[];
  updatedAt: string;
};
