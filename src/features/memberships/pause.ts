import type { Membership, MembershipPause } from '@/features/memberships/types';

/** A pause starts today or within this many days. The server checks too. */
export const MAX_PAUSE_LEAD_DAYS = 30;
/** What the Member rules screen offers when an owner switches pausing on. */
export const SUGGESTED_PAUSE_DAYS = 15;

const DAY = 24 * 60 * 60 * 1000;

function parseDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Days from `from` to `to`, e.g. 1 from today to tomorrow. */
function daysBetween(from: string, to: string) {
  return Math.round((parseDate(to) - parseDate(from)) / DAY);
}

/** How long a pause is, counting both ends. */
export function pauseLength(pause: Pick<MembershipPause, 'startsOn' | 'endsOn'>) {
  return daysBetween(pause.startsOn, pause.endsOn) + 1;
}

export function isPausedOn(pauses: MembershipPause[] | undefined, day: string) {
  return (pauses ?? []).some((p) => p.startsOn <= day && day <= p.endsOn);
}

/** A pause on this membership that's running or still to come, if any. */
export function currentPause(membership: Pick<Membership, 'pauses'>, today: string) {
  return (membership.pauses ?? []).find((p) => p.endsOn >= today) ?? null;
}

/** The member's running or upcoming pause across their memberships. Only one is allowed. */
export function findCurrentPause(memberships: Pick<Membership, 'pauses'>[], today: string) {
  for (const m of memberships) {
    const pause = currentPause(m, today);
    if (pause) return pause;
  }
  return null;
}

/** The membership covering a day, the one a pause starting then would go on. */
export function membershipOn<M extends Pick<Membership, 'startsOn' | 'endsOn'>>(
  memberships: M[],
  day: string,
): M | null {
  return (
    memberships
      .filter((m) => m.startsOn <= day && day <= m.endsOn)
      .sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0] ?? null
  );
}

export function pauseDaysUsed(membership: Pick<Membership, 'pauses'>) {
  return (membership.pauses ?? []).reduce((sum, p) => sum + pauseLength(p), 0);
}

/** Pause days still available on a membership, given the gym's limit per membership. */
export function pauseDaysLeft(membership: Pick<Membership, 'pauses'>, maxDays: number) {
  return Math.max(maxDays - pauseDaysUsed(membership), 0);
}

/**
 * Days that come off the membership again when a pause ends today: all of them if it
 * hasn't started (or starts today), otherwise today through its last day.
 */
export function unusedPauseDays(pause: MembershipPause, today: string) {
  if (pause.startsOn >= today) return pauseLength(pause);
  return Math.max(daysBetween(today, pause.endsOn) + 1, 0);
}
