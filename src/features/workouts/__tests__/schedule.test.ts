import {
  daysLabel,
  isDue,
  isoWeekday,
  lastDoneByPlan,
  planDayStatus,
  statusLabel,
  toggleDay,
} from '@/features/workouts/schedule';

// 2026-11-02 is a Monday.
const mon = new Date(2026, 10, 2, 9);
const tue = new Date(2026, 10, 3, 9);
const wed = new Date(2026, 10, 4, 9);

describe('weekdays', () => {
  it('counts Monday as 1 and Sunday as 7', () => {
    expect(isoWeekday(mon)).toBe(1);
    expect(isoWeekday(new Date(2026, 10, 8))).toBe(7);
  });

  it('labels days', () => {
    expect(daysLabel([])).toBe('Any day');
    expect(daysLabel([5, 1, 3, 3])).toBe('Mon, Wed, Fri');
    expect(daysLabel([1, 2, 3, 4, 5, 6, 7])).toBe('Every day');
  });

  it('toggles a day and keeps them sorted', () => {
    expect(toggleDay([3], 1)).toEqual([1, 3]);
    expect(toggleDay([1, 3], 1)).toEqual([3]);
  });
});

describe('planDayStatus', () => {
  it('is any day without days', () => {
    const status = planDayStatus([], mon, 1, null);
    expect(status.kind).toBe('anytime');
    expect(isDue(status)).toBe(true);
  });

  it('is due on its day, and says when it is done', () => {
    expect(planDayStatus([1], mon, 1, null)).toEqual({ kind: 'today', doneToday: false });
    expect(planDayStatus([1], mon, 1, new Date(2026, 10, 2, 7))).toEqual({
      kind: 'today',
      doneToday: true,
    });
  });

  it('spills over a missed day for the catch-up days', () => {
    const status = planDayStatus([1], tue, 1, null);
    expect(status.kind).toBe('catchUp');
    expect(isDue(status)).toBe(true);
    expect(statusLabel(status)).toBe('Missed Mon, do it today');
  });

  it('closes after the catch-up days', () => {
    const status = planDayStatus([1], wed, 1, null);
    expect(status).toEqual({ kind: 'later', nextDay: 1 });
    expect(isDue(status)).toBe(false);
    expect(planDayStatus([1], wed, 2, null).kind).toBe('catchUp');
  });

  it('has no catch-up when the gym sets 0', () => {
    expect(planDayStatus([1], tue, 0, null).kind).toBe('later');
  });

  it('does not spill over once done', () => {
    expect(planDayStatus([1], tue, 1, new Date(2026, 10, 2, 18)).kind).toBe('later');
    // Done on the catch-up day itself.
    expect(planDayStatus([1], wed, 2, new Date(2026, 10, 3, 18)).kind).toBe('later');
  });

  it('shows the next day it is on', () => {
    expect(statusLabel(planDayStatus([1, 4], tue, 0, null))).toBe('Next: Thu');
  });
});

describe('lastDoneByPlan', () => {
  it('keeps the latest finish per plan', () => {
    const last = lastDoneByPlan([
      { workoutId: 'w1', completedAt: '2026-11-01T10:00:00Z' },
      { workoutId: 'w1', completedAt: '2026-11-02T10:00:00Z' },
      { workoutId: null, completedAt: '2026-11-03T10:00:00Z' },
    ]);
    expect(last.get('w1')?.toISOString()).toBe('2026-11-02T10:00:00.000Z');
    expect(last.size).toBe(1);
  });
});
