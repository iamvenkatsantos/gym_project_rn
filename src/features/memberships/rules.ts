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
export function daysRemaining(membership: Membership, today: Date = new Date()) {
  const diff = Math.round((parseDate(membership.endsOn) - startOfDay(today)) / DAY);
  return Math.max(diff + 1, 0);
}

export function membershipStatus(
  membership: Membership,
  today: Date = new Date(),
): MembershipStatus {
  if (parseDate(membership.startsOn) > startOfDay(today)) return 'upcoming';
  const left = daysRemaining(membership, today);
  if (left === 0) return 'expired';
  if (left <= EXPIRING_SOON_DAYS) return 'expiringSoon';
  return 'active';
}
