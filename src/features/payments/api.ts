import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import type { OnlinePayment, StartedPayment } from '@/features/payments/types';
import { delay } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type OnlinePaymentRow = {
  id: string;
  gym_id: string;
  member_id: string;
  plan_id: string;
  amount_cents: number;
  currency: string;
  status: OnlinePayment['status'];
  link_url: string | null;
  razorpay_payment_id: string | null;
  fee_cents: number | null;
  transfer_error: string | null;
  created_at: string;
  paid_at: string | null;
  member: { full_name: string } | null;
  plan: { name: string } | null;
  membership: { starts_on: string; ends_on: string } | null;
};

const COLUMNS =
  'id, gym_id, member_id, plan_id, amount_cents, currency, status, link_url, razorpay_payment_id, fee_cents, transfer_error, created_at, paid_at, member:profiles(full_name), plan:membership_plans(name), membership:memberships(starts_on, ends_on)';

function toPayment(row: OnlinePaymentRow): OnlinePayment {
  return {
    id: row.id,
    gymId: row.gym_id,
    memberId: row.member_id,
    planId: row.plan_id,
    memberName: row.member?.full_name ?? 'Member',
    planName: row.plan?.name ?? 'Membership',
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    linkUrl: row.link_url,
    razorpayPaymentId: row.razorpay_payment_id,
    startsOn: row.membership?.starts_on ?? null,
    endsOn: row.membership?.ends_on ?? null,
    feeCents: row.fee_cents,
    transferError: row.transfer_error,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

/** Whether the branch takes online payments. Demo data never does. */
export async function fetchOnlinePaymentsEnabled(gymId: string): Promise<boolean> {
  if (!supabase) return delay(false);
  const { data, error } = await supabase
    .from('gyms')
    .select('online_payments')
    .eq('id', gymId)
    .maybeSingle();
  if (error) throw error;
  return data?.online_payments === true;
}

/** Starts paying for a plan: returns Razorpay's payment page to open. */
export async function startOnlinePayment(gymId: string, planId: string): Promise<StartedPayment> {
  if (!supabase) throw new Error('Online payments need the live app');
  const { data, error } = await supabase.functions.invoke<StartedPayment>('create-payment', {
    body: { gymId, planId },
  });
  if (!error && data) return data;
  if (
    error instanceof FunctionsFetchError ||
    (error instanceof FunctionsHttpError && error.context.status === 404)
  ) {
    throw new Error("Online payments aren't set up yet. Please pay at the front desk.");
  }
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body?.error) throw new Error(body.error);
  }
  throw error instanceof Error ? error : new Error('Something went wrong');
}

export async function fetchOnlinePayment(paymentId: string): Promise<OnlinePayment | null> {
  if (!supabase) return delay(null);
  const { data, error } = await supabase
    .from('online_payments')
    .select(COLUMNS)
    .eq('id', paymentId)
    .maybeSingle();
  if (error) throw error;
  return data ? toPayment(data as unknown as OnlinePaymentRow) : null;
}

/**
 * Recent online payments at the gym. RLS gives members their own and owners and
 * supervisors everyone's.
 */
export async function listOnlinePayments(
  gymId: string,
  memberId?: string,
  limit = 20,
): Promise<OnlinePayment[]> {
  if (!supabase) return delay([]);
  let query = supabase.from('online_payments').select(COLUMNS).eq('gym_id', gymId);
  if (memberId) query = query.eq('member_id', memberId);
  const rows = unwrap(
    await query.order('created_at', { ascending: false }).limit(limit),
  ) as unknown as OnlinePaymentRow[];
  return rows.map(toPayment);
}
