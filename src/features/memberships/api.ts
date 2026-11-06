import type {
  LoyaltyOffer,
  Membership,
  MembershipInput,
  MembershipPause,
  MembershipPlan,
  PlanInput,
} from '@/features/memberships/types';
import {
  currentPause,
  isPausedOn,
  membershipOn,
  unusedPauseDays,
} from '@/features/memberships/pause';
import { addDays, coversToday, toIsoDate } from '@/features/memberships/rules';
import {
  delay,
  forGym,
  mockId,
  mockLoyalty,
  mockMemberships,
  mockPeople,
  mockPlans,
} from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  currency: string;
  duration_days: number;
  offer_type: 'percent' | 'flat' | null;
  offer_value: number | null;
  offer_label: string | null;
  offer_starts_on: string | null;
  offer_ends_on: string | null;
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
  pauses: PauseRow[] | null;
};

type PauseRow = { id: string; starts_on: string; ends_on: string };

function toPause(row: PauseRow): MembershipPause {
  return { id: row.id, startsOn: row.starts_on, endsOn: row.ends_on };
}

const PLAN_COLUMNS =
  'id, name, price_cents, currency, duration_days, offer_type, offer_value, offer_label, offer_starts_on, offer_ends_on';
// The inner join lets queries filter memberships by the plan's gym.
const MEMBERSHIP_COLUMNS = `id, member_id, starts_on, ends_on, amount_paid_cents, payment_method, created_at, member:profiles!memberships_member_id_fkey(full_name), plan:membership_plans!inner(${PLAN_COLUMNS}), pauses:membership_pauses(id, starts_on, ends_on)`;

function toPlan(row: PlanRow): MembershipPlan {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    currency: row.currency,
    durationDays: row.duration_days,
    offer:
      row.offer_type && row.offer_value && row.offer_ends_on
        ? {
            type: row.offer_type,
            value: row.offer_value,
            label: row.offer_label ?? '',
            startsOn: row.offer_starts_on,
            endsOn: row.offer_ends_on,
          }
        : null,
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
    pauses: (row.pauses ?? []).map(toPause),
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
    const mine = forGym(gymId, mockMemberships).filter((m) => m.memberId === memberId);
    return delay(mine.sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0] ?? null);
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

/** Whether the member has a membership at this gym covering today. The server checks too. */
export async function hasCurrentMembership(gymId: string, memberId: string): Promise<boolean> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockMemberships).some((m) => m.memberId === memberId && coversToday(m)),
    );
  }
  const today = toIsoDate(new Date());
  const { data, error } = await supabase
    .from('memberships')
    .select(
      'id, plan:membership_plans!inner(gym_id), pauses:membership_pauses(id, starts_on, ends_on)',
    )
    .eq('member_id', memberId)
    .eq('plan.gym_id', gymId)
    .lte('starts_on', today)
    .gte('ends_on', today);
  if (error) throw error;
  const rows = data as unknown as { pauses: PauseRow[] | null }[];
  // A paused day doesn't count, as on the server.
  return rows.length > 0 && !rows.some((r) => isPausedOn((r.pauses ?? []).map(toPause), today));
}

/** The member's memberships at this gym with their pauses, newest first. */
export async function listMemberMemberships(gymId: string, memberId: string) {
  if (!supabase) {
    return delay(
      forGym(gymId, mockMemberships)
        .filter((m) => m.memberId === memberId)
        .sort((a, b) => b.endsOn.localeCompare(a.endsOn)),
    );
  }
  const rows = unwrap(
    await supabase
      .from('memberships')
      .select(MEMBERSHIP_COLUMNS)
      .eq('member_id', memberId)
      .eq('plan.gym_id', gymId)
      .order('ends_on', { ascending: false })
      .limit(12),
  ) as unknown as MembershipRow[];
  return rows.map(toMembership);
}

/**
 * Pauses a member's membership for `days` days from `startsOn`; it then ends that much later.
 * Members pause their own; owners and supervisors anyone's. Returns the new end date.
 */
export async function pauseMembership(
  gymId: string,
  memberId: string,
  startsOn: string,
  days: number,
): Promise<string> {
  if (!supabase) {
    const mine = forGym(gymId, mockMemberships).filter((m) => m.memberId === memberId);
    const target = membershipOn(mine, startsOn);
    if (!target) throw new Error('No membership on that day');
    if (mine.some((m) => currentPause(m, toIsoDate(new Date())))) {
      throw new Error('A pause is already set. End it first.');
    }
    for (const m of mine) {
      if (m.startsOn > target.endsOn) {
        m.startsOn = addDays(m.startsOn, days);
        m.endsOn = addDays(m.endsOn, days);
      }
    }
    target.endsOn = addDays(target.endsOn, days);
    target.pauses = [
      ...(target.pauses ?? []),
      { id: mockId('pause'), startsOn, endsOn: addDays(startsOn, days - 1) },
    ];
    return delay(target.endsOn);
  }
  return unwrap(
    await supabase.rpc('pause_membership', {
      p_gym_id: gymId,
      p_member_id: memberId,
      p_starts_on: startsOn,
      p_days: days,
    }),
  ) as string;
}

/** Ends a pause today, or cancels one that hasn't started; the unused days come off again. */
export async function endPause(pauseId: string) {
  if (!supabase) {
    const today = toIsoDate(new Date());
    const m = mockMemberships.find((x) => x.pauses?.some((p) => p.id === pauseId));
    const pause = m?.pauses?.find((p) => p.id === pauseId);
    if (!m || !pause) throw new Error('Pause not found');
    const unused = unusedPauseDays(pause, today);
    const oldEnd = m.endsOn;
    m.pauses = m.pauses!.flatMap((p) =>
      p.id !== pauseId ? [p] : p.startsOn >= today ? [] : [{ ...p, endsOn: addDays(today, -1) }],
    );
    for (const later of mockMemberships) {
      if (later.memberId === m.memberId && later.startsOn > oldEnd) {
        later.startsOn = addDays(later.startsOn, -unused);
        later.endsOn = addDays(later.endsOn, -unused);
      }
    }
    m.endsOn = addDays(m.endsOn, -unused);
    return delay(m.endsOn);
  }
  return unwrap(await supabase.rpc('end_pause', { p_pause_id: pauseId })) as string;
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
  const offer = fields.offer;
  const row = {
    name: fields.name,
    price_cents: fields.priceCents,
    duration_days: fields.durationDays,
    offer_type: offer?.type ?? null,
    offer_value: offer?.value ?? null,
    offer_label: offer ? offer.label.trim() || null : null,
    offer_starts_on: offer?.startsOn ?? null,
    offer_ends_on: offer?.endsOn ?? null,
  };
  const { error } = planId
    ? await supabase.from('membership_plans').update(row).eq('id', planId)
    : await supabase.from('membership_plans').insert({ ...row, gym_id: gymId });
  if (error) throw error;
}

/** The branch's loyalty offer, or null when it's off. Members read it too. */
export async function fetchLoyaltyOffer(gymId: string): Promise<LoyaltyOffer | null> {
  if (!supabase) return delay(forGym(gymId, [mockLoyalty.value])[0] ?? null);
  const { data, error } = await supabase
    .from('gyms')
    .select('loyalty_months, loyalty_percent')
    .eq('id', gymId)
    .maybeSingle();
  if (error) throw error;
  return data?.loyalty_months && data.loyalty_percent
    ? { months: data.loyalty_months, percent: data.loyalty_percent }
    : null;
}

/** Owners: switch the loyalty offer on, or off with null. */
export async function saveLoyaltyOffer(gymId: string, offer: LoyaltyOffer | null) {
  if (!supabase) {
    mockLoyalty.value = offer;
    return delay(undefined);
  }
  const { error } = await supabase.rpc('set_loyalty_offer', {
    p_gym_id: gymId,
    p_months: offer?.months ?? null,
    p_percent: offer?.percent ?? null,
  });
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
