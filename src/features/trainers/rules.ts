import type { AvailabilityWindow, BusySlot } from '@/features/trainers/types';

export type Slot = {
  startsAt: string;
  available: boolean;
};

function atTime(day: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

function overlaps(start: number, end: number, busy: BusySlot) {
  return start < new Date(busy.endsAt).getTime() && end > new Date(busy.startsAt).getTime();
}

/**
 * Bookable slots for one day: back-to-back sessions inside each availability
 * window, marked unavailable if they've started or clash with a booked session.
 * Times are the device's local time, which is assumed to match the gym's.
 * The server re-checks every booking, so this is only for display.
 */
export function slotsForDay({
  day,
  availability,
  sessionMinutes,
  busy,
  now = new Date(),
}: {
  day: Date;
  availability: AvailabilityWindow[];
  sessionMinutes: number;
  busy: BusySlot[];
  now?: Date;
}): Slot[] {
  const step = sessionMinutes * 60 * 1000;

  return availability
    .filter((w) => w.weekday === day.getDay())
    .flatMap((window) => {
      const slots: Slot[] = [];
      const end = atTime(day, window.endTime).getTime();
      for (
        let start = atTime(day, window.startTime).getTime();
        start + step <= end;
        start += step
      ) {
        slots.push({
          startsAt: new Date(start).toISOString(),
          available: start > now.getTime() && !busy.some((b) => overlaps(start, start + step, b)),
        });
      }
      return slots;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function initials(fullName: string) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
