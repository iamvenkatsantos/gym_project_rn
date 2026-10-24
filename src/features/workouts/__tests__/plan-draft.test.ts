import {
  addExercise,
  emptyPlan,
  moveExercise,
  planProblem,
  removeExercise,
  setDuration,
  updateExercise,
} from '@/features/workouts/plan-draft';

const squat = { id: 'squat', name: 'Back squat' };
const row = { id: 'row', name: 'Dumbbell row' };
const plank = { id: 'plank', name: 'Plank' };

const withThree = () =>
  [squat, row, plank].reduce((plan, e) => addExercise(plan, e), {
    ...emptyPlan(),
    title: 'Full body',
  });
const order = (plan: ReturnType<typeof emptyPlan>) => plan.exercises.map((e) => e.exerciseId);

describe('plan draft', () => {
  it('adds exercises in order with a starting prescription, each only once', () => {
    const plan = addExercise(withThree(), squat);
    expect(order(plan)).toEqual(['squat', 'row', 'plank']);
    expect(plan.exercises[0]).toMatchObject({
      sets: 3,
      reps: 10,
      targetWeightKg: null,
      restSeconds: 90,
    });
  });

  it('moves exercises up and down, and ignores moves past either end', () => {
    expect(order(moveExercise(withThree(), 2, -1))).toEqual(['squat', 'plank', 'row']);
    expect(order(moveExercise(withThree(), 0, 1))).toEqual(['row', 'squat', 'plank']);
    expect(order(moveExercise(withThree(), 0, -1))).toEqual(['squat', 'row', 'plank']);
    expect(order(moveExercise(withThree(), 2, 1))).toEqual(['squat', 'row', 'plank']);
  });

  it('removes an exercise', () => {
    expect(order(removeExercise(withThree(), 1))).toEqual(['squat', 'plank']);
  });

  it('keeps prescriptions inside the database limits', () => {
    const plan = updateExercise(withThree(), 0, {
      sets: 0,
      reps: 500,
      restSeconds: -15,
      targetWeightKg: 900,
    });
    expect(plan.exercises[0]).toMatchObject({
      sets: 1,
      reps: 100,
      restSeconds: 0,
      targetWeightKg: 500,
    });
    expect(plan.exercises[1]).toMatchObject({ sets: 3, reps: 10 });
  });

  it('treats 0 kg as bodyweight', () => {
    expect(updateExercise(withThree(), 0, { targetWeightKg: 0 }).exercises[0].targetWeightKg).toBe(
      null,
    );
    expect(
      updateExercise(withThree(), 0, { targetWeightKg: 2.5 }).exercises[0].targetWeightKg,
    ).toBe(2.5);
  });

  it('clamps the duration', () => {
    expect(setDuration(emptyPlan(), 0).durationMinutes).toBe(5);
    expect(setDuration(emptyPlan(), 999).durationMinutes).toBe(300);
  });

  it('needs a name and at least one exercise before saving', () => {
    expect(planProblem(emptyPlan())).toBe('Give the plan a name.');
    expect(planProblem({ ...emptyPlan(), title: '   ' })).toBe('Give the plan a name.');
    expect(planProblem({ ...emptyPlan(), title: 'Legs' })).toBe('Add at least one exercise.');
    expect(planProblem(withThree())).toBeNull();
  });
});
