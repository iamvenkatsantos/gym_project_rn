import { starterExercises } from '@/features/exercises/library';
import { PlanLimits, planProblem } from '@/features/workouts/plan-draft';
import { draftFromSmartPlan, smartPlans, smartPlansFor } from '@/features/workouts/smart-plans';
import { holdLabel, stretches, stretchesFor } from '@/features/workouts/stretches';

const muscles = new Set(starterExercises.flatMap((e) => e.muscleGroups));

describe('smart plans', () => {
  it('has at least five plans per level', () => {
    for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
      expect(smartPlansFor(level).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('has unique ids and uses only library exercises within the limits', () => {
    expect(new Set(smartPlans.map((p) => p.id)).size).toBe(smartPlans.length);
    for (const plan of smartPlans) {
      for (const item of plan.exercises) {
        expect(starterExercises.some((e) => e.id === item.libraryId)).toBe(true);
        expect(item.sets).toBeLessThanOrEqual(PlanLimits.sets.max);
        expect(item.reps).toBeLessThanOrEqual(PlanLimits.reps.max);
        expect(item.restSeconds).toBeLessThanOrEqual(PlanLimits.restSeconds.max);
      }
    }
  });

  it('copies into a plan that can be saved', () => {
    for (const plan of smartPlans) {
      const draft = draftFromSmartPlan(plan, starterExercises);
      expect(draft.exercises).toHaveLength(plan.exercises.length);
      expect(planProblem(draft)).toBeNull();
    }
  });

  it('matches database exercises by name and skips missing ones', () => {
    const plan = smartPlans[0];
    const gymExercises = starterExercises
      .filter((e) => e.id !== plan.exercises[0].libraryId)
      .map((e) => ({ ...e, id: `db-${e.id}` }));
    const draft = draftFromSmartPlan(plan, gymExercises);
    expect(draft.exercises).toHaveLength(plan.exercises.length - 1);
    expect(draft.exercises[0].exerciseId).toMatch(/^db-/);
  });
});

describe('stretches', () => {
  it('only names library muscle groups', () => {
    for (const s of stretches) for (const m of s.muscles) expect(muscles.has(m)).toBe(true);
  });

  it('covers every muscle the library trains', () => {
    for (const m of muscles) expect(stretchesFor([m]).length).toBeGreaterThan(0);
  });

  it('covers each worked muscle before repeating, up to six', () => {
    const picked = stretchesFor(['chest', 'triceps', 'legs', 'calves', 'back', 'core', 'biceps']);
    expect(picked.length).toBe(6);
    expect(new Set(picked.map((s) => s.id)).size).toBe(6);
    expect(stretchesFor([])).toEqual([]);
  });

  it('gives every smart plan a cool-down', () => {
    for (const plan of smartPlans) {
      const worked = plan.exercises.flatMap(
        (item) => starterExercises.find((e) => e.id === item.libraryId)?.muscleGroups ?? [],
      );
      expect(stretchesFor(worked).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('labels holds', () => {
    expect(holdLabel({ ...stretches[0], holdSeconds: 30, perSide: true })).toBe('30s each side');
  });
});
