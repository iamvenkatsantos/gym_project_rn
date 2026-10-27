// Razorpay helpers shared by create-payment and razorpay-webhook. Keys come from
// Supabase secrets (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET);
// test keys (rzp_test_...) take test payments only.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const API = 'https://api.razorpay.com/v1';

export function keyId() {
  const id = Deno.env.get('RAZORPAY_KEY_ID');
  if (!id) throw new Error('RAZORPAY_KEY_ID is not set');
  return id;
}

export function keySecret() {
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET');
  if (!secret) throw new Error('RAZORPAY_KEY_SECRET is not set');
  return secret;
}

/** Live keys move real money, so every payment must reach the owner's linked account. */
export function isLiveMode() {
  return keyId().startsWith('rzp_live_');
}

export async function razorpay<T>(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Basic ${btoa(`${keyId()}:${keySecret()}`)}`,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body?.error?.description ?? `Razorpay ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compares signatures without leaking how much matched through timing. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

type RazorpayPayment = { id: string; amount: number; fee: number | null; status: string };

/**
 * Records a captured payment against our online payment and passes the gym's
 * share to the owner's linked account. Safe to run twice (the webhook and the
 * return page can both get here): the membership is recorded once, and the
 * transfer is claimed before it's made so it never goes out twice.
 */
export async function completePayment(
  admin: SupabaseClient,
  onlinePaymentId: string,
  payment: RazorpayPayment,
) {
  // The fee is set once the payment is captured; fetch it if the event didn't carry it.
  const settled =
    payment.fee == null ? await razorpay<RazorpayPayment>(`/payments/${payment.id}`) : payment;

  const { error } = await admin.rpc('complete_online_payment', {
    p_payment_id: onlinePaymentId,
    p_razorpay_payment_id: settled.id,
    p_amount_cents: settled.amount,
    p_fee_cents: settled.fee,
  });
  if (error) throw new Error(error.message);

  await transferToOwner(admin, onlinePaymentId, settled);
}

async function transferToOwner(
  admin: SupabaseClient,
  onlinePaymentId: string,
  payment: RazorpayPayment,
) {
  const { data: row, error } = await admin
    .from('online_payments')
    .select('gym_id, amount_cents, currency, fee_cents, cut_cents, transfer_id, transfer_error')
    .eq('id', onlinePaymentId)
    .single();
  if (error) throw new Error(error.message);
  if (row.transfer_id || row.transfer_error) return;

  const { data: gym } = await admin
    .from('gyms')
    .select('razorpay_account_id')
    .eq('id', row.gym_id)
    .single();
  // No linked account yet (test mode before Route is set up): the money stays
  // with the platform account and the admin settles it by hand.
  if (!gym?.razorpay_account_id) return;

  // The owner pays Razorpay's fee and CoreFit Gym's cut (0 unless switched on).
  const amount = row.amount_cents - (row.fee_cents ?? payment.fee ?? 0) - row.cut_cents;
  if (amount <= 0) return;

  const { data: claimed } = await admin
    .from('online_payments')
    .update({ transfer_id: 'pending' })
    .eq('id', onlinePaymentId)
    .is('transfer_id', null)
    .is('transfer_error', null)
    .select('id');
  if (!claimed?.length) return;

  try {
    const result = await razorpay<{ items: { id: string }[] }>(
      `/payments/${payment.id}/transfers`,
      {
        method: 'POST',
        body: {
          transfers: [
            {
              account: gym.razorpay_account_id,
              amount,
              currency: row.currency,
              notes: { online_payment_id: onlinePaymentId },
              on_hold: false,
            },
          ],
        },
      },
    );
    await admin
      .from('online_payments')
      .update({ transfer_id: result.items?.[0]?.id ?? 'unknown' })
      .eq('id', onlinePaymentId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('route transfer failed', onlinePaymentId, message);
    await admin
      .from('online_payments')
      .update({ transfer_id: null, transfer_error: message.slice(0, 500) })
      .eq('id', onlinePaymentId);
  }
}
