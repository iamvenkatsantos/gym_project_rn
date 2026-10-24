import {
  atMinutes,
  canBook,
  classesOnDay,
  classProblem,
  formatClock,
  minutesOfDay,
  spotsLeft,
  upcomingDays,
  weeklyStarts,
} from '@/features/bookings/rules';
import type { Booking, GymClass } from '@/features/bookings/types';

const now = new Date('2026-10-24T10:00:00Z');

const gymClass: GymClass = {
  id: 'c-1',
  trainerId: 't-1',
  trainerName: 'Tom',
  title: 'HIIT',
  startsAt: '2026-10-24T12:00:00Z',
  durationMinutes: 30,
  capacity: 10,
  bookedCount: 4,
  seriesId: null,
};

describe('spotsLeft', () => {
  it('never goes below zero', () => {
    expect(spotsLeft(gymClass)).toBe(6);
    expect(spotsLeft({ ...gymClass, bookedCount: 12 })).toBe(0);
  });
});

describe('canBook', () => {
  it('allows booking an open future class', () => {
    expect(canBook(gymClass, [], now)).toEqual({ ok: true });
  });

  it('rejects classes that have started', () => {
    expect(canBook({ ...gymClass, startsAt: '2026-10-24T09:00:00Z' }, [], now)).toEqual({
      ok: false,
      reason: 'started',
    });
  });

  it('rejects full classes', () => {
    expect(canBook({ ...gymClass, bookedCount: 10 }, [], now)).toEqual({
      ok: false,
      reason: 'full',
    });
  });

  it('rejects a class the member already booked, but not a cancelled one', () => {
    const booking: Booking = {
      id: 'b-1',
      classId: 'c-1',
      memberId: 'm-1',
      status: 'booked',
      gymClass,
    };
    expect(canBook(gymClass, [booking], now)).toEqual({ ok: false, reason: 'alreadyBooked' });
    expect(canBook(gymClass, [{ ...booking, status: 'cancelled' }], now)).toEqual({ ok: true });
  });
});

describe('classesOnDay', () => {
  it('keeps only classes on the given local day', () => {
    const day = new Date(2026, 9, 24);
    const morning = { ...gymClass, id: 'a', startsAt: new Date(2026, 9, 24, 7).toISOString() };
    const tomorrow = { ...gymClass, id: 'b', startsAt: new Date(2026, 9, 25, 7).toISOString() };
    expect(classesOnDay([morning, tomorrow], day).map((c) => c.id)).toEqual(['a']);
  });
});

describe('upcomingDays', () => {
  it('starts today at midnight', () => {
    const days = upcomingDays(3, new Date(2026, 9, 31, 18));
    expect(days.map((d) => d.getDate())).toEqual([31, 1, 2]);
    expect(days[0].getHours()).toBe(0);
  });
});

describe('scheduling helpers', () => {
  it('builds local times from a day and minutes, and reads them back', () => {
    const start = atMinutes(new Date(2026, 9, 26), 7 * 60 + 30);
    expect(start.getHours()).toBe(7);
    expect(start.getMinutes()).toBe(30);
    expect(minutesOfDay(start.toISOString())).toBe(450);
    expect(formatClock(450)).toBe('07:30');
  });

  it('repeats a class weekly at the same local time', () => {
    const starts = weeklyStarts(new Date(2026, 9, 26, 7, 0), 3);
    expect(starts.map((d) => [d.getMonth(), d.getDate(), d.getHours()])).toEqual([
      [9, 26, 7],
      [10, 2, 7],
      [10, 9, 7],
    ]);
  });

  it('needs a name and a future time', () => {
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    expect(classProblem({ title: ' ', startsAt: future }, now)).toBe('Give the class a name.');
    expect(classProblem({ title: 'HIIT', startsAt: now }, now)).toBe('Pick a time in the future.');
    expect(classProblem({ title: 'HIIT', startsAt: future }, now)).toBeNull();
  });
});
