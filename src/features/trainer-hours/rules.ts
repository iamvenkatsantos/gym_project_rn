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

/** Until the owner saves their own: 8 hours, 2 hours short allowed, 4 hours LOP, Sunday off. */
export const defaultRules: TrainerHourRulesInput = {
  requiredMinutes: 8 * 60,
  shortLimitMinutes: 2 * 60,
  lopMinutes: 4 * 60,
  offDays: [0],
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
 * A working day with the rules applied. Approved permission counts as time worked. A day with
 * no check-in and no permission costs the full day; a day short by more than the allowed
 * shortfall costs the rule's LOP hours.
 */
export function applyRules(
  day: TrainerDay,
  rules: Pick<TrainerHourRules, 'requiredMinutes' | 'shortLimitMinutes' | 'lopMinutes'>,
): TrainerDayResult {
  const credited = day.workedMinutes + day.permissionMinutes;
  const shortMinutes = Math.max(0, rules.requiredMinutes - credited);
  const absent = credited === 0;
  const lopMinutes = absent
    ? rules.requiredMinutes
    : shortMinutes > rules.shortLimitMinutes
      ? rules.lopMinutes
      : 0;
  return { ...day, shortMinutes, lopMinutes, absent };
}

/** The month per trainer, most LOP first. The server leaves out off days and today. */
export function summariseMonth(days: TrainerDay[], rules: TrainerHourRules): TrainerMonth[] {
  const byTrainer = new Map<string, TrainerMonth>();
  for (const day of days) {
    const result = applyRules(day, rules);
    const month = byTrainer.get(day.trainerId) ?? {
      trainerId: day.trainerId,
      fullName: day.fullName,
      workingDays: 0,
      workedMinutes: 0,
      lopMinutes: 0,
      lopDays: [],
    };
    month.workingDays += 1;
    month.workedMinutes += day.workedMinutes;
    month.lopMinutes += result.lopMinutes;
    if (result.lopMinutes > 0) month.lopDays.push(result);
    byTrainer.set(day.trainerId, month);
  }
  for (const month of byTrainer.values()) month.lopDays.sort((a, b) => a.day.localeCompare(b.day));
  return [...byTrainer.values()].sort(
    (a, b) => b.lopMinutes - a.lopMinutes || a.fullName.localeCompare(b.fullName),
  );
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
