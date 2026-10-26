import type { HourCount, MemberInsight, MonthRevenue } from '@/features/insights/types';
import { toIsoDate } from '@/features/memberships/rules';
import { delay, forGym, mockAttendance, mockMemberships, mockPeople } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

// Only the gym's owner gets these numbers; each function checks that on the server.

type RevenueRow = {
  month: string;
  amount_cents: number;
  payments: number;
  new_members: number;
  currency: string;
};

function monthStart(date: Date, monthsAgo = 0) {
  return toIsoDate(new Date(date.getFullYear(), date.getMonth() - monthsAgo, 1));
}

export async function getRevenueByMonth(gymId: string, months: number): Promise<MonthRevenue[]> {
  if (!supabase) {
    // Demo payments count in the month they started.
    const paid = forGym(gymId, mockMemberships);
    const now = new Date();
    return delay(
      Array.from({ length: months }, (_, i) => {
        const month = monthStart(now, months - 1 - i);
        const inMonth = paid.filter((m) => m.startsOn.slice(0, 7) === month.slice(0, 7));
        return {
          month,
          amountCents: inMonth.reduce(
            (sum, m) => sum + (m.amountPaidCents ?? m.plan.priceCents),
            0,
          ),
          payments: inMonth.length,
          newMembers: inMonth.length,
          currency: 'INR',
        };
      }),
    );
  }
  const rows = unwrap(
    await supabase.rpc('revenue_by_month', { p_gym_id: gymId, p_months: months }),
  ) as RevenueRow[];
  return rows.map((r) => ({
    month: r.month,
    amountCents: Number(r.amount_cents),
    payments: r.payments,
    newMembers: r.new_members,
    currency: r.currency,
  }));
}

type MemberRow = {
  user_id: string;
  full_name: string;
  joined_on: string | null;
  starts_on: string | null;
  ends_on: string | null;
  last_visit: string | null;
  visits_30d: number;
};

export async function getMemberInsights(gymId: string): Promise<MemberInsight[]> {
  if (!supabase) {
    const since = toIsoDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
    return delay(
      forGym(gymId, mockPeople)
        .filter((p) => p.role === 'member' && p.status === 'active')
        .map((p) => {
          const latest = mockMemberships
            .filter((m) => m.memberId === p.id)
            .sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0];
          const visits = mockAttendance.filter((a) => a.userId === p.id).map((a) => a.day);
          return {
            userId: p.id,
            fullName: p.fullName,
            joinedOn: toIsoDate(new Date(p.joinedAt)),
            startsOn: latest?.startsOn ?? null,
            endsOn: latest?.endsOn ?? null,
            lastVisit: visits.sort().at(-1) ?? null,
            visitsLast30Days: visits.filter((d) => d >= since).length,
          };
        }),
    );
  }
  const rows = unwrap(await supabase.rpc('member_insights', { p_gym_id: gymId })) as MemberRow[];
  return rows.map((r) => ({
    userId: r.user_id,
    fullName: r.full_name,
    joinedOn: r.joined_on,
    startsOn: r.starts_on,
    endsOn: r.ends_on,
    lastVisit: r.last_visit,
    visitsLast30Days: r.visits_30d,
  }));
}

type HourRow = { weekday: number; hour: number; check_ins: number };

export async function getBusiestHours(gymId: string, days: number): Promise<HourCount[]> {
  if (!supabase) {
    const since = toIsoDate(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
    const counts = new Map<string, HourCount>();
    for (const a of forGym(gymId, mockAttendance)) {
      if (a.role !== 'member' || a.day < since) continue;
      const weekday = ((new Date(a.checkedInAt).getDay() + 6) % 7) + 1;
      const hour = new Date(a.checkedInAt).getHours();
      const key = `${weekday}-${hour}`;
      const entry = counts.get(key) ?? { weekday, hour, checkIns: 0 };
      entry.checkIns += 1;
      counts.set(key, entry);
    }
    return delay([...counts.values()]);
  }
  const rows = unwrap(
    await supabase.rpc('busiest_hours', { p_gym_id: gymId, p_days: days }),
  ) as HourRow[];
  return rows.map((r) => ({ weekday: r.weekday, hour: r.hour, checkIns: r.check_ins }));
}
