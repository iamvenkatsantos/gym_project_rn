import { listDayAttendance } from '@/features/attendance/api';
import { countByRole } from '@/features/attendance/rules';
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
  /** Members and trainers checked in today, and trainers on today's list ("Came today", "Trainers in"). */
  membersPresent: number;
  trainersPresent: number;
  trainersTotal: number;
  /** The soonest-ending renewals, up to HOME_RENEWALS_SHOWN. */
  renewals: Membership[];
};

/** The same numbers worked out from the full lists: demo mode, and before the migration is pushed. */
async function fromAll(gymId: string, today: Date): Promise<OwnerDashboard> {
  const [memberships, people, links, attendance] = await Promise.all([
    listMemberships(gymId),
    listPeople(gymId),
    listTrainerLinks(gymId),
    listDayAttendance(gymId, 0),
  ]);
  const present = countByRole(attendance);
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
    membersPresent: present.member.present,
    trainersPresent: present.trainer.present,
    trainersTotal: present.trainer.total,
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
  const [counts, attendance, renewals] = await Promise.all([
    supabase.rpc('owner_dashboard_counts', { p_gym_id: gymId, p_today: day }),
    // "Came today" and "Trainers in", counted instead of downloading today's whole list.
    supabase.rpc('owner_attendance_counts', { p_gym_id: gymId }),
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
  // Before the attendance-counts migration: count today's list, as Home did before.
  const present =
    attendance.error?.code === 'PGRST202' ? countByRole(await listDayAttendance(gymId, 0)) : null;
  const attendanceRow = present
    ? null
    : (unwrap(attendance) as unknown as AttendanceCountsRow[])[0];
  const row = (unwrap(counts) as unknown as CountsRow[])[0];
  return {
    activeMembers: row?.active_members ?? 0,
    renewalsDue: row?.renewals_due ?? 0,
    noTrainer: row?.no_trainer ?? 0,
    birthdaysToday: row?.birthdays_today ?? 0,
    membersPresent: present?.member.present ?? attendanceRow?.members_present ?? 0,
    trainersPresent: present?.trainer.present ?? attendanceRow?.trainers_present ?? 0,
    trainersTotal: present?.trainer.total ?? attendanceRow?.trainers_total ?? 0,
    renewals: (unwrap(renewals) as unknown as MembershipRow[]).map(toMembership),
  };
}

type AttendanceCountsRow = {
  members_present: number;
  trainers_present: number;
  trainers_total: number;
};

type CountsRow = {
  active_members: number;
  renewals_due: number;
  no_trainer: number;
  birthdays_today: number;
};

/** The most the old function returned (before the cap went up), so a full page may be cut short. */
const OLD_RENEWALS_CAP = 100;

/**
 * Everyone due for renewal (ending within a week, or ended in the last 30 days), soonest to end
 * first, for the Renewals screen: one request instead of every membership. Falls back to the
 * full list before the migrations are pushed.
 */
export async function listRenewalsDue(
  gymId: string,
  today: Date = new Date(),
): Promise<Membership[]> {
  const fromAllMemberships = async () => renewalsDue(await listMemberships(gymId), today);
  if (!supabase) return fromAllMemberships();
  const { data, error } = await supabase
    .rpc('gym_renewals_due', { p_gym_id: gymId, p_today: toIsoDate(today), p_limit: 1000 })
    .select(MEMBERSHIP_COLUMNS)
    .order('ends_on')
    .order('id');
  if (error?.code === 'PGRST202') return fromAllMemberships();
  const rows = unwrap({ data, error }) as unknown as MembershipRow[];
  // The older function stops at 100; a full page may be cut short, so count it from the full list.
  if (rows.length === OLD_RENEWALS_CAP) return fromAllMemberships();
  return rows.map(toMembership);
}
