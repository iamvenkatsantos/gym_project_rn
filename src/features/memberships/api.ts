import type {
  Membership,
  MembershipInput,
  MembershipPlan,
  PlanInput,
} from '@/features/memberships/types';
import { delay, forGym, mockId, mockMemberships, mockPeople, mockPlans } from '@/lib/mock-db';
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
  amount_paid_cents: number | null;
  payment_method: Membership['paymentMethod'];
  created_at: string;
  member: { full_name: string };
  plan: PlanRow;
};

const PLAN_COLUMNS = 'id, name, price_cents, currency, duration_days';
// The inner join lets queries filter memberships by the plan's gym.
const MEMBERSHIP_COLUMNS = `id, member_id, starts_on, ends_on, amount_paid_cents, payment_method, created_at, member:profiles!memberships_member_id_fkey(full_name), plan:membership_plans!inner(${PLAN_COLUMNS})`;

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
    amountPaidCents: row.amount_paid_cents,
    paymentMethod: row.payment_method,
    recordedAt: row.created_at,
  };
}

export async function listPlans(gymId: string): Promise<MembershipPlan[]> {
  if (!supabase) return delay(forGym(gymId, mockPlans));
  const rows = unwrap(
    await supabase
      .from('membership_plans')
      .select(PLAN_COLUMNS)
      .eq('gym_id', gymId)
      .eq('active', true)
      .order('price_cents'),
  );
  return rows.map(toPlan);
}

/** The member's latest membership at this gym, whether or not it has expired. */
export async function getCurrentMembership(
  gymId: string,
  memberId: string,
): Promise<Membership | null> {
  if (!supabase) {
    return delay(forGym(gymId, mockMemberships).find((m) => m.memberId === memberId) ?? null);
  }
  const { data, error } = await supabase
    .from('memberships')
    .select(MEMBERSHIP_COLUMNS)
    .eq('member_id', memberId)
    .eq('plan.gym_id', gymId)
    .order('ends_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toMembership(data as unknown as MembershipRow) : null;
}

/** Every membership in the gym. RLS only lets owners see other people's. */
export async function listMemberships(gymId: string): Promise<Membership[]> {
  if (!supabase) return delay(forGym(gymId, mockMemberships));
  const rows = unwrap(
    await supabase
      .from('memberships')
      .select(MEMBERSHIP_COLUMNS)
      .eq('plan.gym_id', gymId)
      .order('ends_on'),
  ) as unknown as MembershipRow[];
  return rows.map(toMembership);
}

/** Creates a plan (planId null) or edits one. Existing memberships keep what was paid. */
export async function savePlan(gymId: string, planId: string | null, input: PlanInput) {
  const fields = { ...input, name: input.name.trim() };
  if (!supabase) {
    const existing = mockPlans.find((p) => p.id === planId);
    if (existing) Object.assign(existing, fields);
    else mockPlans.push({ id: mockId('p'), currency: 'INR', ...fields });
    mockPlans.sort((a, b) => a.priceCents - b.priceCents);
    return delay(undefined);
  }
  const row = {
    name: fields.name,
    price_cents: fields.priceCents,
    duration_days: fields.durationDays,
  };
  const { error } = planId
    ? await supabase.from('membership_plans').update(row).eq('id', planId)
    : await supabase.from('membership_plans').insert({ ...row, gym_id: gymId });
  if (error) throw error;
}

/** Hides a plan from sale. Memberships already on it are unaffected. */
export async function archivePlan(planId: string) {
  if (!supabase) {
    const index = mockPlans.findIndex((p) => p.id === planId);
    if (index >= 0) mockPlans.splice(index, 1);
    return delay(undefined);
  }
  const { error } = await supabase
    .from('membership_plans')
    .update({ active: false })
    .eq('id', planId);
  if (error) throw error;
}

/** Records a membership paid at the front desk. */
export async function recordMembership(gymId: string, input: MembershipInput) {
  if (!supabase) {
    const plan = forGym(gymId, mockPlans).find((p) => p.id === input.planId);
    const member = mockPeople.find((p) => p.id === input.memberId);
    if (!plan || !member) throw new Error('Pick a member and a plan');
    mockMemberships.push({
      id: mockId('m'),
      memberId: member.id,
      memberName: member.fullName,
      plan,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      amountPaidCents: input.amountPaidCents,
      paymentMethod: input.paymentMethod,
    });
    return delay(undefined);
  }
  const { error } = await supabase.from('memberships').insert({
    member_id: input.memberId,
    plan_id: input.planId,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    amount_paid_cents: input.amountPaidCents,
    payment_method: input.paymentMethod,
    note: input.note.trim(),
  });
  if (error) throw error;
}

/**
 * Pushes a member a reminder to renew. Each member hears once a day however
 * many staff tap it; false means they were already reminded today.
 */
export async function remindRenewal(gymId: string, memberId: string): Promise<boolean> {
  if (!supabase) return delay(true);
  return unwrap(
    await supabase.rpc('remind_renewal', { p_gym_id: gymId, p_member_id: memberId }),
  ) as boolean;
}
