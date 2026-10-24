import type { AvailabilityWindow } from '@/features/trainers/types';

/** Monday first, the way most gyms print their timetable. weekday: 0 = Sunday. */
export const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
export const weekdayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Times move in half hours, and a window ends by 23:30 so it never crosses midnight. */
export const TimeStep = 30;
const LAST_MINUTE = 23 * 60 + 30;

export const SessionLimits = { min: 15, max: 240, step: 15 } as const;

export function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function fromMinutes(total: number) {
  const clamped = Math.min(LAST_MINUTE, Math.max(0, total));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

export function windowsForDay(windows: AvailabilityWindow[], weekday: number) {
  return windows
    .filter((w) => w.weekday === weekday)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Adds a window to a day: 07:00–11:00 on an empty day, otherwise two hours after the last one. */
export function addWindow(windows: AvailabilityWindow[], weekday: number): AvailabilityWindow[] {
  const day = windowsForDay(windows, weekday);
  const last = day[day.length - 1];
  const start = last ? toMinutes(last.endTime) + 60 : 7 * 60;
  if (start + TimeStep > LAST_MINUTE) return windows;
  return [
    ...windows,
    {
      weekday,
      startTime: fromMinutes(start),
      endTime: fromMinutes(Math.min(start + (last ? 120 : 240), LAST_MINUTE)),
    },
  ];
}

export function updateWindow(
  windows: AvailabilityWindow[],
  target: AvailabilityWindow,
  patch: Partial<Pick<AvailabilityWindow, 'startTime' | 'endTime'>>,
) {
  return windows.map((w) => (w === target ? { ...w, ...patch } : w));
}

export function removeWindow(windows: AvailabilityWindow[], target: AvailabilityWindow) {
  return windows.filter((w) => w !== target);
}

/** Copies one day's windows onto every other weekday (Monday to Saturday), replacing theirs. */
export function copyToWeekdays(windows: AvailabilityWindow[], weekday: number) {
  const source = windowsForDay(windows, weekday);
  const targets = [1, 2, 3, 4, 5, 6].filter((d) => d !== weekday);
  return [
    ...windows.filter((w) => !targets.includes(w.weekday)),
    ...targets.flatMap((d) => source.map((w) => ({ ...w, weekday: d }))),
  ];
}

/** Why the hours can't be saved yet, or null when they can. */
export function availabilityProblem(windows: AvailabilityWindow[]): string | null {
  for (const weekday of weekdayOrder) {
    const day = windowsForDay(windows, weekday);
    for (const [i, w] of day.entries()) {
      if (toMinutes(w.endTime) <= toMinutes(w.startTime)) {
        return `${weekdayNames[weekday]}: ${w.startTime} to ${w.endTime} ends before it starts.`;
      }
      const next = day[i + 1];
      if (next && toMinutes(next.startTime) < toMinutes(w.endTime)) {
        return `${weekdayNames[weekday]}: ${w.startTime}–${w.endTime} overlaps ${next.startTime}–${next.endTime}.`;
      }
    }
  }
  return null;
}

/** Total bookable hours in a week. */
export function weeklyHours(windows: AvailabilityWindow[]) {
  return windows.reduce((sum, w) => sum + toMinutes(w.endTime) - toMinutes(w.startTime), 0) / 60;
}
