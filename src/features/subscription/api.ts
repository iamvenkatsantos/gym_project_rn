import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { mockBranch } from '@/features/branches/api';
import { branchAccess, nextPeriod } from '@/features/subscription/rules';
import type {
  BranchAccess,
  StartedSubscriptionPayment,
  Subscription,
  SubscriptionPayment,
} from '@/features/subscription/types';
import { delay, mockDay, mockId } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type SubscriptionRow = {
  fee_cents: number;
  addon_cents: number;
  amount_cents: number;
  currency: string;
  paid_until: string | null;
  today: string;
};

type PaymentRow = {
  id: string;
  gym_id: string;
  method: SubscriptionPayment['method'];
  amount_cents: number;
  currency: string;
  status: SubscriptionPayment['status'];
  period_start: string | null;
  period_end: string | null;
  note: string | null;
  created_at: string;
  paid_at: string | null;
};

const COLUMNS =
  'id, gym_id, method, amount_cents, currency, status, period_start, period_end, note, created_at, paid_at';

function toPayment(row: PaymentRow): SubscriptionPayment {
  return {
    id: row.id,
    gymId: row.gym_id,
    method: row.method,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    note: row.note,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

const mockPayments: SubscriptionPayment[] = [];

/** The branch's owners and the admin: what a year costs and how long it's paid for. */
export async function fetchSubscription(gymId: string): Promise<Subscription> {
  if (!supabase) {
    const branch = mockBranch(gymId);
    const feeCents = branch?.feeCents ?? 499900;
    const addonCents = 0;
    return delay({
      feeCents,
      addonCents,
      amountCents: feeCents + addonCents,
      currency: 'INR',
      paidUntil: branch?.paidUntil ?? null,
      today: mockDay(),
    });
  }
  const rows = unwrap(
    await supabase.rpc('branch_subscription', { p_gym_id: gymId }),
  ) as SubscriptionRow[];
  const row = rows[0];
  if (!row) throw new Error('Branch not found');
  return {
    feeCents: row.fee_cents,
    addonCents: row.addon_cents,
    amountCents: row.amount_cents,
    currency: row.currency,
    paidUntil: row.paid_until,
    today: row.today,
  };
}

/** The branch's payments to CoreFit Gym, newest first. Owners and the admin only (RLS). */
export async function listSubscriptionPayments(gymId: string): Promise<SubscriptionPayment[]> {
  if (!supabase) return delay(mockPayments.filter((p) => p.gymId === gymId));
  const rows = unwrap(
    await supabase
      .from('subscription_payments')
      .select(COLUMNS)
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(50),
  ) as PaymentRow[];
  return rows.map(toPayment);
}

export async function fetchSubscriptionPayment(id: string): Promise<SubscriptionPayment | null> {
  if (!supabase) return delay(mockPayments.find((p) => p.id === id) ?? null);
  const { data, error } = await supabase
    .from('subscription_payments')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? toPayment(data as PaymentRow) : null;
}

/** Starts paying for the branch's next year: returns Razorpay's payment page to open. */
export async function startSubscriptionPayment(gymId: string): Promise<StartedSubscriptionPayment> {
  if (!supabase) throw new Error('Paying CoreFit Gym needs the live app');
  const { data, error } = await supabase.functions.invoke<StartedSubscriptionPayment>(
    'create-subscription-payment',
    { body: { gymId } },
  );
  if (!error && data) return data;
  if (
    error instanceof FunctionsFetchError ||
    (error instanceof FunctionsHttpError && error.context.status === 404)
  ) {
    throw new Error("Paying in the app isn't set up yet. Please contact CoreFit Gym.");
  }
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body?.error) throw new Error(body.error);
  }
  throw error instanceof Error ? error : new Error('Something went wrong');
}

/**
 * Admins only: a year paid outside the app (cash, bank transfer), or given free
 * with an amount of 0. Returns the new paid-until date.
 */
export async function recordSubscription(
  gymId: string,
  amountCents: number,
  note: string,
): Promise<string> {
  if (!supabase) {
    const { start: periodStart, end: periodEnd } = nextPeriod(await fetchSubscription(gymId));
    const branch = mockBranch(gymId);
    if (branch) branch.paidUntil = periodEnd;
    mockPayments.unshift({
      id: mockId('sub'),
      gymId,
      method: 'manual',
      amountCents,
      currency: 'INR',
      status: 'paid',
      periodStart,
      periodEnd,
      note: note.trim() || null,
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
    });
    return delay(periodEnd);
  }
  return unwrap(
    await supabase.rpc('admin_record_subscription', {
      p_gym_id: gymId,
      p_amount_cents: amountCents,
      p_note: note.trim() || null,
    }),
  ) as string;
}

/** Anyone at the branch: whether its plan is paid, and when the app locks if not. */
export async function fetchBranchAccess(gymId: string): Promise<BranchAccess> {
  if (!supabase) {
    const sub = await fetchSubscription(gymId);
    const startedOn = mockBranch(gymId)?.createdAt.slice(0, 10) ?? sub.today;
    return branchAccess(sub, startedOn);
  }
  const rows = unwrap(await supabase.rpc('branch_access', { p_gym_id: gymId })) as {
    paid: boolean;
    locks_on: string | null;
    locked: boolean;
  }[];
  const row = rows[0];
  return { paid: row?.paid ?? true, locksOn: row?.locks_on ?? null, locked: row?.locked ?? false };
}

/**
 * Admins only: free time for a branch, 1 to 12 months, running on from the paid year
 * (or today if it lapsed). Returns the new paid-until date.
 */
export async function giveFreeMonths(gymId: string, months: number): Promise<string> {
  if (!supabase) {
    const sub = await fetchSubscription(gymId);
    const { start } = nextPeriod(sub);
    const [y, m, d] = start.split('-').map(Number);
    const periodEnd = new Date(Date.UTC(y, m - 1 + months, d - 1)).toISOString().slice(0, 10);
    const branch = mockBranch(gymId);
    if (branch) branch.paidUntil = periodEnd;
    mockPayments.unshift({
      id: mockId('sub'),
      gymId,
      method: 'manual',
      amountCents: 0,
      currency: 'INR',
      status: 'paid',
      periodStart: start,
      periodEnd,
      note: `Free ${months} month${months === 1 ? '' : 's'}`,
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
    });
    return delay(periodEnd);
  }
  return unwrap(
    await supabase.rpc('admin_give_free_months', { p_gym_id: gymId, p_months: months }),
  ) as string;
}
