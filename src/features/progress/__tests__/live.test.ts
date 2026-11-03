import type { WorkoutDraft } from '@/features/progress/draft-store';
import {
  draftVolumeKg,
  exerciseDone,
  nextSet,
  setCounts,
  setTarget,
} from '@/features/progress/live';

const set = (done: boolean, weightKg: number | null = 20) => ({ reps: 10, weightKg, done });

const draft = (sets: boolean[][]): WorkoutDraft => ({
  clientId: 'c',
  gymId: 'g',
  workoutId: 'w',
  title: 'Push day',
  startedAt: '2026-11-03T06:00:00.000Z',
  exercises: sets.map((s, i) => ({
    exerciseId: `e${i}`,
    name: `Exercise ${i}`,
    restSeconds: 60,
    sets: s.map((d) => set(d)),
  })),
});

describe('live workout', () => {
  it('finishes this exercise before moving on', () => {
    expect(nextSet(draft([[true, false], [false]]), 0)).toEqual({ exercise: 0, set: 1 });
    expect(nextSet(draft([[true, true], [false]]), 0)).toEqual({ exercise: 1, set: 0 });
  });

  it('comes back to skipped exercises at the end', () => {
    expect(nextSet(draft([[false], [true], [true]]), 1)).toEqual({ exercise: 0, set: 0 });
    expect(nextSet(draft([[true], [true]]), 0)).toBeNull();
  });

  it('counts sets and volume', () => {
    const d = draft([[true, false], [true]]);
    expect(setCounts(d)).toEqual({ done: 2, total: 3 });
    expect(draftVolumeKg(d)).toBe(400);
    expect(exerciseDone(d.exercises[0])).toBe(false);
    expect(exerciseDone(d.exercises[1])).toBe(true);
  });

  it('describes a set', () => {
    expect(setTarget(set(false))).toBe('10 reps · 20 kg');
    expect(setTarget(set(false, null))).toBe('10 reps · Bodyweight');
  });
});
