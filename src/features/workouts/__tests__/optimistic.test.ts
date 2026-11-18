import { withAssignment, withDays } from '@/features/workouts/optimistic';
import type { Workout } from '@/features/workouts/types';

const plan = (id: string, assigned: string[], memberDays: Record<string, number[]> = {}) =>
  ({ id, assignedMemberIds: assigned, memberDays }) as unknown as Workout;

describe('withAssignment', () => {
  it('ticks a member on that plan only', () => {
    const list = [plan('a', ['m1']), plan('b', [])];
    const next = withAssignment(list, 'a', 'm2', true);
    expect(next[0].assignedMemberIds).toEqual(['m1', 'm2']);
    expect(next[1]).toBe(list[1]);
  });

  it('unticks a member and drops their days', () => {
    const next = withAssignment([plan('a', ['m1', 'm2'], { m2: [1, 3] })], 'a', 'm2', false);
    expect(next[0].assignedMemberIds).toEqual(['m1']);
    expect(next[0].memberDays).toEqual({});
  });

  it('never adds a member twice', () => {
    const next = withAssignment([plan('a', ['m1'])], 'a', 'm1', true);
    expect(next[0].assignedMemberIds).toEqual(['m1']);
  });
});

describe('withDays', () => {
  it('sets one member’s days on that plan', () => {
    const next = withDays([plan('a', ['m1'], { m1: [1] })], 'a', 'm1', [2, 4]);
    expect(next[0].memberDays).toEqual({ m1: [2, 4] });
  });
});
