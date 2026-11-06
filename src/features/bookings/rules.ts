import type { Booking, GymClass } from '@/features/bookings/types';

export function spotsLeft(gymClass: GymClass) {
  return Math.max(gymClass.capacity - gymClass.bookedCount, 0);
}

/** waitlist: the class is full, so booking joins its waitlist. */
export type BookingEligibility =
  { ok: true; waitlist: boolean } | { ok: false; reason: 'started' | 'alreadyBooked' | 'limit' };

/** Booked or waiting: what counts against the gym's booking limit. */
export function isHeld(booking: Pick<Booking, 'status'>) {
  return booking.status === 'booked' || booking.status === 'waitlisted';
}

/**
 * Whether the member can book a class, or join its waitlist when it's full. `cap` is the
 * gym's limit on upcoming classes held at once (null = none). The server checks too.
 */
export function canBook(
  gymClass: GymClass,
  myBookings: Booking[],
  now: Date = new Date(),
  cap: number | null = null,
): BookingEligibility {
  if (new Date(gymClass.startsAt) <= now) return { ok: false, reason: 'started' };
  if (myBookings.some((b) => b.classId === gymClass.id && isHeld(b))) {
    return { ok: false, reason: 'alreadyBooked' };
  }
  const held = myBookings.filter((b) => isHeld(b) && new Date(b.gymClass.startsAt) > now).length;
  if (cap !== null && held >= cap) return { ok: false, reason: 'limit' };
  return { ok: true, waitlist: spotsLeft(gymClass) === 0 };
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

/** Midnight-based local time on a given day, e.g. minutes 450 → 07:30. */
export function atMinutes(day: Date, minutes: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
}

export function minutesOfDay(iso: string) {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

export function formatClock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** The start of each class in a weekly repeat, keeping the same local time across DST changes. */
export function weeklyStarts(first: Date, weeks: number) {
  return Array.from(
    { length: weeks },
    (_, w) =>
      new Date(
        first.getFullYear(),
        first.getMonth(),
        first.getDate() + 7 * w,
        first.getHours(),
        first.getMinutes(),
      ),
  );
}

/** Why a class can't be scheduled yet, or null when it can. */
export function classProblem(input: { title: string; startsAt: Date }, now: Date = new Date()) {
  if (!input.title.trim()) return 'Give the class a name.';
  if (input.startsAt <= now) return 'Pick a time in the future.';
  return null;
}
