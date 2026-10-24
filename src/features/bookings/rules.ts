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

export function fillRate(gymClass: GymClass) {
  return gymClass.capacity === 0 ? 1 : gymClass.bookedCount / gymClass.capacity;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function classesOnDay(classes: GymClass[], day: Date) {
  return classes.filter((c) => isSameDay(new Date(c.startsAt), day));
}

/** Today plus the following days, at local midnight. */
export function upcomingDays(count: number, from: Date = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    return day;
  });
}
