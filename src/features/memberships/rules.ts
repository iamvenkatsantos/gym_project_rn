import type { Membership } from '@/features/memberships/types';

const DAY = 24 * 60 * 60 * 1000;
export const EXPIRING_SOON_DAYS = 7;

export type MembershipStatus = 'active' | 'expiringSoon' | 'expired' | 'upcoming';

function startOfDay(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days left including today; 0 once the end date has passed. */
export function daysRemaining(membership: Pick<Membership, 'endsOn'>, today: Date = new Date()) {
  const diff = Math.round((parseDate(membership.endsOn) - startOfDay(today)) / DAY);
  return Math.max(diff + 1, 0);
}

export function membershipStatus(
  membership: Pick<Membership, 'startsOn' | 'endsOn'>,
  today: Date = new Date(),
): MembershipStatus {
  if (parseDate(membership.startsOn) > startOfDay(today)) return 'upcoming';
  const left = daysRemaining(membership, today);
  if (left === 0) return 'expired';
  if (left <= EXPIRING_SOON_DAYS) return 'expiringSoon';
  return 'active';
}

/** Share of the membership period still remaining, from 1 at the start to 0 at the end. */
export function remainingFraction(membership: Membership, today: Date = new Date()) {
  const total =
    Math.round((parseDate(membership.endsOn) - parseDate(membership.startsOn)) / DAY) + 1;
  return Math.min(daysRemaining(membership, today) / total, 1);
}

/**
 * Memberships that need a renewal conversation, soonest first. Only each
 * member's latest membership counts, so someone who already renewed drops off.
 */
export function renewalsDue(memberships: Membership[], today: Date = new Date()) {
  return [...latestByMember(memberships).values()]
    .filter((m) => {
      const status = membershipStatus(m, today);
      return status === 'expiringSoon' || status === 'expired';
    })
    .sort((a, b) => a.endsOn.localeCompare(b.endsOn));
}

/** A date as YYYY-MM-DD in local time, the format the database's date columns use. */
export function toIsoDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return toIsoDate(new Date(y, m - 1, d + days));
}

/** The last day of a membership that starts on startsOn, counting the start day. */
export function endDateFor(startsOn: string, durationDays: number) {
  return addDays(startsOn, durationDays - 1);
}

/**
 * When a renewal should start: the day after the current membership ends, so
 * renewing early doesn't lose days, or today if it has already run out.
 */
export function renewalStart(current: Membership | null | undefined, today: Date = new Date()) {
  const todayIso = toIsoDate(today);
  if (!current) return todayIso;
  const next = addDays(current.endsOn, 1);
  return next > todayIso ? next : todayIso;
}

/** Parses "1,499" or "1499.50" rupees into paise; null for anything else. */
export function parseRupees(text: string) {
  const cleaned = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

/** The latest membership per member, for picking whom to renew. */
export function latestByMember(memberships: Membership[]) {
  const latest = new Map<string, Membership>();
  for (const m of memberships) {
    const seen = latest.get(m.memberId);
    if (!seen || m.endsOn > seen.endsOn) latest.set(m.memberId, m);
  }
  return latest;
}
