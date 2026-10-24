import {
  durationMinutes,
  personalRecords,
  startOfWeek,
  volumeKg,
  weekStreak,
  workoutsThisWeek,
} from '@/features/progress/rules';
import type { LoggedSet, WorkoutLog } from '@/features/progress/types';

// Thursday 29 Oct 2026, local time.
const now = new Date(2026, 9, 29, 18);

function log(completedAt: Date, sets: LoggedSet[] = []): WorkoutLog {
  return {
    clientId: completedAt.toISOString(),
    workoutId: null,
    title: 'Workout',
    startedAt: new Date(completedAt.getTime() - 45 * 60000).toISOString(),
    completedAt: completedAt.toISOString(),
    sets,
  };
}

const squat = (setNumber: number, reps: number, weightKg: number | null): LoggedSet => ({
  exerciseId: 'squat',
  exerciseName: 'Back squat',
  setNumber,
  reps,
  weightKg,
});

describe('startOfWeek', () => {
  it('goes back to Monday midnight, including from a Sunday', () => {
    expect(startOfWeek(now)).toEqual(new Date(2026, 9, 26));
    expect(startOfWeek(new Date(2026, 10, 1, 9))).toEqual(new Date(2026, 9, 26));
  });
});

describe('workoutsThisWeek and weekStreak', () => {
  const logs = [
    log(new Date(2026, 9, 27, 7)), // this week
    log(new Date(2026, 9, 20, 7)), // last week
    log(new Date(2026, 9, 14, 7)), // two weeks ago
    log(new Date(2026, 8, 30, 7)), // gap before this
  ];

  it('counts workouts since Monday', () => {
    expect(workoutsThisWeek(logs, now)).toBe(1);
  });

  it('counts back consecutive active weeks', () => {
    expect(weekStreak(logs, now)).toBe(3);
  });

  it("doesn't break the streak just because this week hasn't had a workout yet", () => {
    expect(weekStreak(logs.slice(1), now)).toBe(2);
    expect(weekStreak([], now)).toBe(0);
  });
});

describe('volumeKg and durationMinutes', () => {
  it('sums reps × weight and ignores bodyweight sets', () => {
    const l = log(now, [squat(1, 5, 60), squat(2, 5, 62.5), squat(3, 10, null)]);
    expect(volumeKg(l)).toBe(612.5);
    expect(durationMinutes(l)).toBe(45);
  });
});

describe('personalRecords', () => {
  it('keeps the heaviest set per exercise, breaking ties on reps', () => {
    const records = personalRecords([
      log(new Date(2026, 9, 20), [squat(1, 5, 60), squat(2, 3, 70)]),
      log(new Date(2026, 9, 27), [squat(1, 5, 70)]),
      log(new Date(2026, 9, 28), [
        { exerciseId: 'pushup', exerciseName: 'Push-up', setNumber: 1, reps: 15, weightKg: null },
        { exerciseId: 'pushup', exerciseName: 'Push-up', setNumber: 2, reps: 18, weightKg: null },
      ]),
    ]);
    expect(records.map((r) => [r.exerciseName, r.weightKg, r.reps])).toEqual([
      ['Back squat', 70, 5],
      ['Push-up', null, 18],
    ]);
    expect(records[0].achievedAt).toBe(new Date(2026, 9, 27).toISOString());
  });
});
