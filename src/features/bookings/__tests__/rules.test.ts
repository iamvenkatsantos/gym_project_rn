import { canBook, spotsLeft } from '@/features/bookings/rules';
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
