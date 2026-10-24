import type { Membership, MembershipPlan } from '@/features/memberships/types';
import { delay, mockMemberships, mockPlans } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  duration_days: number;
};

type MembershipRow = {
  id: string;
  member_id: string;
  starts_on: string;
  ends_on: string;
  member: { full_name: string };
  plan: PlanRow;
};

const PLAN_COLUMNS = 'id, name, price_cents, currency, duration_days';
const MEMBERSHIP_COLUMNS = `id, member_id, starts_on, ends_on, member:profiles(full_name), plan:membership_plans(${PLAN_COLUMNS})`;

function toPlan(row: PlanRow): MembershipPlan {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    currency: row.currency,
    durationDays: row.duration_days,
  };
}

function toMembership(row: MembershipRow): Membership {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member.full_name,
    plan: toPlan(row.plan),
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  };
}

export async function listPlans(): Promise<MembershipPlan[]> {
  if (!supabase) return delay(mockPlans);
  const rows = unwrap(
    await supabase
      .from('membership_plans')
      .select(PLAN_COLUMNS)
      .eq('active', true)
      .order('price_cents'),
  );
  return rows.map(toPlan);
}

/** The member's latest membership, whether or not it has expired. */
export async function getCurrentMembership(memberId: string): Promise<Membership | null> {
  if (!supabase) {
    return delay(mockMemberships.find((m) => m.memberId === memberId) ?? null);
  }
  const { data, error } = await supabase
    .from('memberships')
    .select(MEMBERSHIP_COLUMNS)
    .eq('member_id', memberId)
    .order('ends_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toMembership(data as unknown as MembershipRow) : null;
}

/** Every membership in the owner's gym; RLS scopes rows to that gym. */
export async function listMemberships(): Promise<Membership[]> {
  if (!supabase) return delay(mockMemberships);
  const rows = unwrap(
    await supabase.from('memberships').select(MEMBERSHIP_COLUMNS).order('ends_on'),
  ) as unknown as MembershipRow[];
  return rows.map(toMembership);
}
