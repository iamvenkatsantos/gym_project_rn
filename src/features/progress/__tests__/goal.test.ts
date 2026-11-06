import {
  DefaultWeeklyGoal,
  daysTrainedThisWeek,
  goalLine,
  goalStreak,
  weeklyGoal,
  weeklyGoalSummary,
} from '@/features/progress/goal';
import type { WorkoutLog } from '@/features/progress/types';
import type { Workout } from '@/features/workouts/types';

// Thursday 29 Oct 2026, local time. That week runs Mon 26 Oct to Sun 1 Nov.
const now = new Date(2026, 9, 29, 18);
const day = (date: number, month = 9, hour = 8) => new Date(2026, month, date, hour);

function log(completedAt: Date): WorkoutLog {
  return {
    clientId: completedAt.toISOString(),
    workoutId: null,
    title: 'Workout',
    startedAt: new Date(completedAt.getTime() - 45 * 60000).toISOString(),
    completedAt: completedAt.toISOString(),
    sets: [],
  };
}

function plan(days: Record<string, number[]>): Workout {
  return {
    id: Object.values(days).join('-'),
    trainerId: 't1',
    title: 'Plan',
    description: '',
    level: 'beginner',
    durationMinutes: 45,
    exercises: [],
    assignedMemberIds: Object.keys(days),
    memberDays: days,
  };
}

describe('weeklyGoal', () => {
  it('counts the distinct weekdays of the member’s plans', () => {
    expect(weeklyGoal([plan({ m1: [1, 3] }), plan({ m1: [3, 5], m2: [2] })], 'm1')).toBe(3);
  });

  it('falls back to the default when no plan has days', () => {
    expect(weeklyGoal([], 'm1')).toBe(DefaultWeeklyGoal);
    expect(weeklyGoal([plan({ m1: [] }), plan({ m2: [1, 2, 3, 4] })], 'm1')).toBe(
      DefaultWeeklyGoal,
    );
  });
});

describe('daysTrainedThisWeek', () => {
  it('counts each day once and ignores last week', () => {
    const logs = [day(26), day(26, 9, 19), day(28), day(25)].map(log);
    expect(daysTrainedThisWeek(logs, now)).toEqual([1, 3]);
  });
});

describe('goalStreak', () => {
  // Two days in each of the three weeks before this one.
  const past = [day(5), day(7), day(12), day(14), day(19), day(21)].map(log);

  it('counts weeks in a row that met the goal, waiting on an unfinished week', () => {
    expect(goalStreak(past, 2, now)).toBe(3);
    expect(goalStreak([...past, log(day(26))], 2, now)).toBe(3);
  });

  it('adds this week once it is met', () => {
    expect(goalStreak([...past, log(day(26)), log(day(27))], 2, now)).toBe(4);
  });

  it('stops at a week short of the goal', () => {
    expect(goalStreak(past, 3, now)).toBe(0);
    const gap = [day(5), day(7), day(14), day(19), day(21)].map(log);
    expect(goalStreak(gap, 2, now)).toBe(1);
  });
});

describe('weeklyGoalSummary and goalLine', () => {
  it('caps the ring at full and says when the goal is reached', () => {
    const logs = [day(26), day(27), day(28)].map(log);
    const summary = weeklyGoalSummary([plan({ m1: [1, 3] })], logs, 'm1', now);
    expect(summary).toMatchObject({ goal: 2, done: 3, progress: 1, days: [1, 2, 3] });
    expect(goalLine(summary)).toBe('Goal reached');
    expect(goalLine({ goal: 4, done: 1 })).toBe('3 more to go');
  });
});
