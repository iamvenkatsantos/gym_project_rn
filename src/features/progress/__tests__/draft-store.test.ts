import { draftToLog, useWorkoutDraft } from '@/features/progress/draft-store';
import type { Workout } from '@/features/workouts/types';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'client-1' }));

const workout: Workout = {
  id: 'w-1',
  trainerId: 't-1',
  title: 'Leg day',
  description: '',
  level: 'beginner',
  durationMinutes: 45,
  assignedMemberIds: [],
  memberDays: {},
  exercises: [
    {
      exerciseId: 'squat',
      name: 'Back squat',
      sets: 2,
      reps: 5,
      targetWeightKg: 60,
      restSeconds: 120,
    },
    {
      exerciseId: 'lunge',
      name: 'Lunge',
      sets: 1,
      reps: 10,
      targetWeightKg: null,
      restSeconds: 60,
    },
  ],
};

const store = () => useWorkoutDraft.getState();

beforeEach(() => {
  store().discard();
});

describe('workout draft', () => {
  it('starts with the prescribed sets, reps and weights', () => {
    store().start('gym-1', workout);
    const draft = store().draft!;
    expect(draft.clientId).toBe('client-1');
    expect(draft.exercises[0].sets).toEqual([
      { reps: 5, weightKg: 60, done: false },
      { reps: 5, weightKg: 60, done: false },
    ]);
  });

  it('starts the rest timer when a set is ticked, and stops it when unticked', () => {
    store().start('gym-1', workout);
    const before = Date.now();
    store().toggleSet(0, 0);
    expect(store().restUntil).toBeGreaterThanOrEqual(before + 120_000);
    store().toggleSet(0, 0);
    expect(store().restUntil).toBeNull();
  });

  it('copies the last set when adding one', () => {
    store().start('gym-1', workout);
    store().updateSet(0, 1, { weightKg: 62.5 });
    store().addSet(0);
    expect(store().draft!.exercises[0].sets[2]).toEqual({ reps: 5, weightKg: 62.5, done: false });
  });

  it('logs only completed sets, renumbered per exercise', () => {
    store().start('gym-1', workout);
    store().toggleSet(0, 1);
    store().updateSet(0, 1, { reps: 6 });
    store().toggleSet(1, 0);
    const log = draftToLog(store().draft!, new Date('2026-10-26T10:00:00Z'));
    expect(log.sets).toEqual([
      { exerciseId: 'squat', exerciseName: 'Back squat', setNumber: 1, reps: 6, weightKg: 60 },
      { exerciseId: 'lunge', exerciseName: 'Lunge', setNumber: 1, reps: 10, weightKg: null },
    ]);
    expect(log.completedAt).toBe('2026-10-26T10:00:00.000Z');
  });

  it('replaces an exercise, keeps its sets and records the swap', () => {
    store().start('gym-1', workout);
    store().toggleSet(0, 0);
    store().replaceExercise(0, { id: 'smith', name: 'Smith squat' });
    const replaced = store().draft!.exercises[0];
    expect(replaced).toMatchObject({ exerciseId: 'smith', name: 'Smith squat' });
    expect(replaced.sets).toHaveLength(2);
    expect(replaced.sets[0].done).toBe(true);
    // An exercise already in the workout can't be picked again.
    store().replaceExercise(0, { id: 'lunge', name: 'Lunge' });
    expect(store().draft!.exercises[0].exerciseId).toBe('smith');
    const log = draftToLog(store().draft!);
    expect(log.swaps).toEqual(['Back squat → Smith squat']);
    expect(log.sets[0].exerciseId).toBe('smith');
  });

  it('carries the self-check into the log', () => {
    store().start('gym-1', workout);
    expect(draftToLog(store().draft!).selfCheck).toBeNull();
    store().setSelfCheck({ effort: 8, pain: 'Knee', note: null });
    expect(draftToLog(store().draft!).selfCheck).toEqual({ effort: 8, pain: 'Knee', note: null });
  });
});
