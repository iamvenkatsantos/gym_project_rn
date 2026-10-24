import type { Booking, GymClass } from '@/features/bookings/types';

export function spotsLeft(gymClass: GymClass) {
  return Math.max(gymClass.capacity - gymClass.bookedCount, 0);
}

export type BookingEligibility =
  { ok: true } | { ok: false; reason: 'started' | 'full' | 'alreadyBooked' };

export function canBook(
  gymClass: GymClass,
  myBookings: Booking[],
  now: Date = new Date(),
): BookingEligibility {
  if (new Date(gymClass.startsAt) <= now) return { ok: false, reason: 'started' };
  if (myBookings.some((b) => b.classId === gymClass.id && b.status === 'booked')) {
    return { ok: false, reason: 'alreadyBooked' };
  }
  if (spotsLeft(gymClass) === 0) return { ok: false, reason: 'full' };
  return { ok: true };
}
