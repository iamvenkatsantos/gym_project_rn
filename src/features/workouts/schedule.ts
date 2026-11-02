/**
 * Weekday plans. A coach picks the days a member does each assigned plan
 * (ISO weekdays, 1 = Monday ... 7 = Sunday); no days means any day. A missed
 * day stays open for the gym's catch-up days unless the member already did it.
 */

export const Weekdays = [
  { day: 1, short: 'Mon', letter: 'M' },
  { day: 2, short: 'Tue', letter: 'T' },
  { day: 3, short: 'Wed', letter: 'W' },
  { day: 4, short: 'Thu', letter: 'T' },
  { day: 5, short: 'Fri', letter: 'F' },
  { day: 6, short: 'Sat', letter: 'S' },
  { day: 7, short: 'Sun', letter: 'S' },
] as const;

export const CatchUpLimits = { min: 0, max: 3 } as const;

/** 1 = Monday ... 7 = Sunday, in local time. */
export function isoWeekday(date: Date) {
  return ((date.getDay() + 6) % 7) + 1;
}

function shortName(day: number) {
  return Weekdays.find((w) => w.day === day)?.short ?? '';
}

/** Days sorted and without repeats. */
export function normaliseDays(days: readonly number[]) {
  return [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
}

export function toggleDay(days: readonly number[], day: number) {
  return normaliseDays(days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
}

/** "Mon, Wed, Fri", "Every day" or "Any day" for none. */
export function daysLabel(days: readonly number[]) {
  const sorted = normaliseDays(days);
  if (sorted.length === 0) return 'Any day';
  if (sorted.length === 7) return 'Every day';
  return sorted.map(shortName).join(', ');
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export type PlanDayStatus =
  /** No days picked: start it any day. */
  | { kind: 'anytime' }
  /** Today is one of its days. */
  | { kind: 'today'; doneToday: boolean }
  /** Its day was missed, and it's still within the catch-up days. */
  | { kind: 'catchUp'; missedDay: number; lastDay: Date }
  /** Not due: done, or its catch-up time is over. Shows the next day. */
  | { kind: 'later'; nextDay: number };

/**
 * Whether a member can do a plan today.
 * lastDoneAt is when they last finished this plan, if ever.
 */
export function planDayStatus(
  days: readonly number[],
  now: Date,
  catchUpDays: number,
  lastDoneAt: Date | null,
): PlanDayStatus {
  const sorted = normaliseDays(days);
  if (sorted.length === 0) return { kind: 'anytime' };
  const today = startOfDay(now);
  const weekday = isoWeekday(today);
  if (sorted.includes(weekday)) {
    return { kind: 'today', doneToday: !!lastDoneAt && lastDoneAt >= today };
  }
  // The most recent scheduled day, if it was within the catch-up days.
  for (let back = 1; back <= Math.min(catchUpDays, 6); back += 1) {
    const day = addDays(today, -back);
    if (!sorted.includes(isoWeekday(day))) continue;
    const done = !!lastDoneAt && lastDoneAt >= day;
    if (!done) {
      return { kind: 'catchUp', missedDay: isoWeekday(day), lastDay: addDays(day, catchUpDays) };
    }
    break;
  }
  const next = [1, 2, 3, 4, 5, 6].map((n) => isoWeekday(addDays(today, n)));
  return { kind: 'later', nextDay: next.find((d) => sorted.includes(d)) ?? sorted[0] };
}

/** Whether the status lets the member start the plan today. */
export function isDue(status: PlanDayStatus) {
  return status.kind !== 'later';
}

/** One short line for the plan's card. */
export function statusLabel(status: PlanDayStatus) {
  switch (status.kind) {
    case 'anytime':
      return 'Any day';
    case 'today':
      return status.doneToday ? 'Done today' : 'Today';
    case 'catchUp':
      return `Missed ${shortName(status.missedDay)}, do it today`;
    case 'later':
      return `Next: ${shortName(status.nextDay)}`;
  }
}

/** When each plan was last finished, from the member's logs. */
export function lastDoneByPlan(logs: readonly { workoutId: string | null; completedAt: string }[]) {
  const last = new Map<string, Date>();
  for (const log of logs) {
    if (!log.workoutId) continue;
    const at = new Date(log.completedAt);
    const prev = last.get(log.workoutId);
    if (!prev || at > prev) last.set(log.workoutId, at);
  }
  return last;
}
