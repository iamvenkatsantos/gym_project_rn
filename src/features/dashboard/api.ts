import { listDayAttendance } from '@/features/attendance/api';
import { countByRole } from '@/features/attendance/rules';
import { upcomingBirthdays } from '@/features/birthdays/rules';
import { listTrainerLinks } from '@/features/coaching/api';
import { unmappedMembers } from '@/features/coaching/rules';
import { listPeople } from '@/features/members/api';
import { listMemberships } from '@/features/memberships/api';
import { latestByMember, membershipStatus, toIsoDate } from '@/features/memberships/rules';
import type { DashboardCounts } from '@/features/dashboard/types';
import { supabase } from '@/lib/supabase';

/**
 * The owner Home tiles, counted on the server (`owner_dashboard_counts`) instead of from the full
 * people, membership, attendance and trainer-link lists. Demo mode, and a server without the
 * migration yet, count those lists here with the same rules.
 */
export async function fetchDashboardCounts(
  gymId: string,
  today: Date = new Date(),
): Promise<DashboardCounts> {
  if (supabase) {
    const { data, error } = await supabase
      .rpc('owner_dashboard_counts', { p_gym_id: gymId, p_today: toIsoDate(today) })
      .single();
    if (!error) {
      const row = data as {
        active_members: number;
        no_trainer: number;
        birthdays_today: number;
        members_present: number;
        trainers_present: number;
        trainers_total: number;
      };
      return {
        activeMembers: row.active_members,
        noTrainer: row.no_trainer,
        birthdaysToday: row.birthdays_today,
        membersPresent: row.members_present,
        trainersPresent: row.trainers_present,
        trainersTotal: row.trainers_total,
      };
    }
    if (error.code !== 'PGRST202') throw error;
  }
  return countFromLists(gymId, today);
}

async function countFromLists(gymId: string, today: Date): Promise<DashboardCounts> {
  const [memberships, people, links, attendance] = await Promise.all([
    listMemberships(gymId),
    listPeople(gymId),
    listTrainerLinks(gymId),
    listDayAttendance(gymId, 0),
  ]);
  const present = countByRole(attendance);
  return {
    activeMembers: [...latestByMember(memberships).values()].filter((m) => {
      const status = membershipStatus(m, today);
      return status === 'active' || status === 'expiringSoon';
    }).length,
    noTrainer: unmappedMembers(people, links).length,
    birthdaysToday: upcomingBirthdays(people, today, 0).length,
    membersPresent: present.member.present,
    trainersPresent: present.trainer.present,
    trainersTotal: present.trainer.total,
  };
}
