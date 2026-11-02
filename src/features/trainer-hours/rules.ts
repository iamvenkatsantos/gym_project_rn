import type {
  PermissionInput,
  PermissionReason,
  PermissionStatus,
  TrainerDay,
  TrainerDayResult,
  TrainerHourRules,
  TrainerHourRulesInput,
  TrainerMonth,
  WorkPermission,
} from '@/features/trainer-hours/types';

export const MAX_NOTE = 200;

/** The reasons a trainer picks from, in the order they're shown. */
export const permissionReasons: { value: PermissionReason; label: string }[] = [
  { value: 'medical', label: 'Medical' },
  { value: 'family', label: 'Family emergency' },
  { value: 'personal', label: 'Personal work' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
];

export function reasonLabel(reason: PermissionReason) {
  return permissionReasons.find((r) => r.value === reason)?.label ?? 'Other';
}

export const statusPill: Record<
  PermissionStatus,
  { label: string; tone: 'warning' | 'success' | 'danger' }
> = {
  pending: { label: 'Waiting', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Not approved', tone: 'danger' },
};

/** Sunday first, as Date.getDay() counts. */
export const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Until the owner saves their own: 8 h, 2 h short allowed, 4 h LOP, Sunday off; late after 15 min, 2 days in a row cost 4 h. */
export const defaultRules: TrainerHourRulesInput = {
  requiredMinutes: 8 * 60,
  shortLimitMinutes: 2 * 60,
  lopMinutes: 4 * 60,
  offDays: [0],
  lateAfterMinutes: 15,
  lateStreakDays: 2,
  lateLopMinutes: 4 * 60,
};

/** "8 h", "7.5 h": hours for steppers and totals. */
export function hoursLabel(minutes: number) {
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${h} h`;
}

/** What's wrong with the owner's rules, or null. */
export function rulesProblem(rules: TrainerHourRulesInput) {
  if (rules.shortLimitMinutes >= rules.requiredMinutes)
    return 'Allowed shortfall must be less than the working hours.';
  if (rules.offDays.length >= 7) return 'Leave at least one working day.';
  return null;
}

/**
 * A working day with the shortfall rule applied. Approved permission counts as time worked. A
 * day with no check-in and no permission costs the full day; a day short by more than the
 * allowed shortfall costs the rule's LOP hours. Late streaks are added by summariseMonth.
 */
export function applyRules(
  day: TrainerDay,
  rules: Pick<TrainerHourRules, 'requiredMinutes' | 'shortLimitMinutes' | 'lopMinutes'> &
    Partial<Pick<TrainerHourRules, 'lateAfterMinutes'>>,
): TrainerDayResult {
  const credited = day.workedMinutes + day.permissionMinutes;
  const shortMinutes = Math.max(0, rules.requiredMinutes - credited);
  const absent = credited === 0;
  const lopMinutes = absent
    ? rules.requiredMinutes
    : shortMinutes > rules.shortLimitMinutes
      ? rules.lopMinutes
      : 0;
  return {
    ...day,
    shortMinutes,
    lopMinutes,
    absent,
    late: isLate(day, rules.lateAfterMinutes ?? null),
    lateLopMinutes: 0,
  };
}

/**
 * Late: the first check-in is more than lateAfterMinutes after the branch opens, and no approved
 * permission starts by then. Never late when the rule is off, the branch is open 24 hours or
 * they didn't come.
 */
export function isLate(
  day: Pick<TrainerDay, 'firstInMinute' | 'permissionFromMinute' | 'opensMinute'>,
  lateAfterMinutes: number | null,
) {
  if (lateAfterMinutes === null || day.opensMinute === null || day.firstInMinute === null)
    return false;
  const by = day.opensMinute + lateAfterMinutes;
  if (day.permissionFromMinute !== null && day.permissionFromMinute <= by) return false;
  return day.firstInMinute > by;
}

/**
 * One trainer's working days, oldest first, with late streaks charged: every lateStreakDays late
 * days in a row cost lateLopMinutes on the day the streak completes, then the count starts
 * again. An on-time or absent day resets it; off days aren't in the list, so they don't.
 */
export function applyLateStreaks(
  days: TrainerDayResult[],
  rules: Pick<TrainerHourRules, 'lateStreakDays' | 'lateLopMinutes'>,
): TrainerDayResult[] {
  let run = 0;
  return days.map((d) => {
    if (!d.late) {
      run = 0;
      return d;
    }
    run += 1;
    if (run < rules.lateStreakDays) return d;
    run = 0;
    return {
      ...d,
      lateLopMinutes: rules.lateLopMinutes,
      lopMinutes: d.lopMinutes + rules.lateLopMinutes,
    };
  });
}

/**
 * The month per trainer, most LOP first. The server leaves out off days and today. Streaks
 * count within the month.
 */
export function summariseMonth(days: TrainerDay[], rules: TrainerHourRules): TrainerMonth[] {
  const byTrainer = new Map<string, TrainerDay[]>();
  for (const day of days) {
    byTrainer.set(day.trainerId, [...(byTrainer.get(day.trainerId) ?? []), day]);
  }
  const months = [...byTrainer.values()].map((list): TrainerMonth => {
    const results = applyLateStreaks(
      [...list].sort((a, b) => a.day.localeCompare(b.day)).map((d) => applyRules(d, rules)),
      rules,
    );
    return {
      trainerId: list[0].trainerId,
      fullName: list[0].fullName,
      workingDays: results.length,
      workedMinutes: results.reduce((sum, d) => sum + d.workedMinutes, 0),
      lopMinutes: results.reduce((sum, d) => sum + d.lopMinutes, 0),
      lateDays: results.filter((d) => d.late).length,
      lopDays: results.filter((d) => d.lopMinutes > 0),
    };
  });
  return months.sort((a, b) => b.lopMinutes - a.lopMinutes || a.fullName.localeCompare(b.fullName));
}

/** What's wrong with a permission request, or null. */
export function permissionProblem(input: PermissionInput) {
  if (input.endsAt <= input.startsAt) return 'End time must be after the start time.';
  if (input.note.trim().length > MAX_NOTE) return `Keep the note under ${MAX_NOTE} characters.`;
  if (input.reason === 'other' && !input.note.trim()) return 'Add a note for Other.';
  return null;
}

/** Waiting requests first (soonest day first), then the rest, newest day first. */
export function sortPermissions(list: WorkPermission[]) {
  return [...list].sort((a, b) => {
    const waitingA = a.status === 'pending' ? 0 : 1;
    const waitingB = b.status === 'pending' ? 0 : 1;
    if (waitingA !== waitingB) return waitingA - waitingB;
    if (waitingA === 0) return a.day.localeCompare(b.day) || a.startsAt - b.startsAt;
    return b.day.localeCompare(a.day) || b.startsAt - a.startsAt;
  });
}

export function pendingCount(list: WorkPermission[]) {
  return list.filter((p) => p.status === 'pending').length;
}

/** "HH:MM" from minutes after midnight, for the server's time columns. */
export function toTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Minutes after midnight from the server's "HH:MM[:SS]". */
export function fromTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** First day of the month `monthsAgo` months back, YYYY-MM-01. */
export function monthStart(monthsAgo: number, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** "October 2026" */
export function monthLabel(isoMonth: string) {
  return new Date(`${isoMonth.slice(0, 7)}-15T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}
