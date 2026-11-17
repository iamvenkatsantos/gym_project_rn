import { listTrainerLinks } from '@/features/coaching/api';
import { unmappedMembers } from '@/features/coaching/rules';
import { upcomingBirthdays } from '@/features/birthdays/rules';
import { listPeople } from '@/features/members/api';
import {
  MEMBERSHIP_COLUMNS,
  listMemberships,
  toMembership,
  type MembershipRow,
} from '@/features/memberships/api';
import {
  latestByMember,
  membershipStatus,
  renewalsDue,
  toIsoDate,
} from '@/features/memberships/rules';
import type { Membership } from '@/features/memberships/types';
import { supabase, unwrap } from '@/lib/supabase';

/** Renewals the owner's Home lists before "See all". */
export const HOME_RENEWALS_SHOWN = 2;

export type OwnerDashboard = {
  activeMembers: number;
  renewalsDue: number;
  /** Active members with no trainer yet. */
  noTrainer: number;
  birthdaysToday: number;
  /** The soonest-ending renewals, up to HOME_RENEWALS_SHOWN. */
  renewals: Membership[];
};

/** The same numbers worked out from the full lists: demo mode, and before the migration is pushed. */
async function fromAll(gymId: string, today: Date): Promise<OwnerDashboard> {
  const [memberships, people, links] = await Promise.all([
    listMemberships(gymId),
    listPeople(gymId),
    listTrainerLinks(gymId),
  ]);
  const active = [...latestByMember(memberships).values()].filter((m) => {
    const status = membershipStatus(m, today);
    return status === 'active' || status === 'expiringSoon';
  });
  const due = renewalsDue(memberships, today);
  return {
    activeMembers: active.length,
    renewalsDue: due.length,
    noTrainer: unmappedMembers(people, links).length,
    birthdaysToday: upcomingBirthdays(people, today, 0).length,
    renewals: due.slice(0, HOME_RENEWALS_SHOWN),
  };
}

/**
 * What the owner's and supervisor's Home shows, in one small request instead of every person,
 * membership and trainer link: owner_dashboard_counts() for the numbers and gym_renewals_due()
 * for the rows, side by side. `today` is the phone's own date, like the rest of the app.
 */
export async function getOwnerDashboard(
  gymId: string,
  today: Date = new Date(),
): Promise<OwnerDashboard> {
  if (!supabase) return fromAll(gymId, today);
  const day = toIsoDate(today);
  const [counts, renewals] = await Promise.all([
    supabase.rpc('owner_dashboard_counts', { p_gym_id: gymId, p_today: day }),
    supabase
      .rpc('gym_renewals_due', { p_gym_id: gymId, p_today: day, p_limit: HOME_RENEWALS_SHOWN })
      .select(MEMBERSHIP_COLUMNS)
      .order('ends_on')
      .order('id'),
  ]);
  // Before the migration is pushed: work it out from the full lists, as the app always did.
  if (counts.error?.code === 'PGRST202' || renewals.error?.code === 'PGRST202') {
    return fromAll(gymId, today);
  }
  const row = (unwrap(counts) as unknown as CountsRow[])[0];
  return {
    activeMembers: row?.active_members ?? 0,
    renewalsDue: row?.renewals_due ?? 0,
    noTrainer: row?.no_trainer ?? 0,
    birthdaysToday: row?.birthdays_today ?? 0,
    renewals: (unwrap(renewals) as unknown as MembershipRow[]).map(toMembership),
  };
}

type CountsRow = {
  active_members: number;
  renewals_due: number;
  no_trainer: number;
  birthdays_today: number;
};
