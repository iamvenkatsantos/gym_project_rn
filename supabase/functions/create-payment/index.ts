// Starts an online payment for a membership plan and returns Razorpay's payment
// page for it. The member checks out there (UPI, cards, netbanking); the payment
// only counts once razorpay-webhook confirms it. With { preview: true } it only
// returns what the member would pay, so the app can show the charges first.
// Deploy with:
//   npx supabase functions deploy create-payment
import { createClient } from 'npm:@supabase/supabase-js@2';

import { memberPrice } from '../_shared/fees.ts';
import { adminClient, feeRates, isLiveMode, razorpay } from '../_shared/razorpay.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Razorpay wants at least 15 minutes; an unpaid page expires after this.
const LINK_MINUTES = 20;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/**
 * What a member pays for a plan at a branch: the price, plus Razorpay's fees when
 * the branch passes them on. CoreFit Gym's cut is always the owner's.
 */
async function quote(
  admin: ReturnType<typeof adminClient>,
  gymId: string,
  baseCents: number,
  currency: string,
) {
  const [{ data: gym }, { data: settings }] = await Promise.all([
    admin.from('gyms').select('online_fees_on_member').eq('id', gymId).single(),
    admin.from('platform_settings').select('online_cut_bps').eq('id', true).single(),
  ]);
  const cutCents = Math.floor((baseCents * (settings?.online_cut_bps ?? 0)) / 10000);
  const price = memberPrice(baseCents, cutCents, gym?.online_fees_on_member !== false, feeRates());
  return { price: { ...price, currency }, cutCents };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Unauthorized' }, 401);

  const { gymId, planId, preview } = await req.json().catch(() => ({}));
  if (typeof gymId !== 'string' || typeof planId !== 'string') {
    return json({ error: 'gymId and planId are required' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });

  if (preview === true) {
    // Read as the member, so they only see plans at their own gym.
    const { data: plan } = await caller
      .from('membership_plans')
      .select('price_cents, currency')
      .eq('id', planId)
      .eq('gym_id', gymId)
      .eq('active', true)
      .maybeSingle();
    if (!plan) return json({ error: "That plan isn't on sale any more" }, 400);
    const { price } = await quote(adminClient(), gymId, plan.price_cents, plan.currency);
    return json(price);
  }
  // Checks the caller is a member, the branch takes online payments and the plan is on sale.
  const { data: paymentId, error } = await caller.rpc('start_online_payment', {
    p_gym_id: gymId,
    p_plan_id: planId,
  });
  if (error) return json({ error: error.message }, 400);

  const admin = adminClient();
  const { data: row, error: readError } = await admin
    .from('online_payments')
    .select(
      'id, amount_cents, currency, member_id, plan:membership_plans(name), gym:gyms(name, razorpay_account_id)',
    )
    .eq('id', paymentId)
    .single();
  if (readError) return json({ error: readError.message }, 500);

  const gym = row.gym as unknown as { name: string; razorpay_account_id: string | null };
  const plan = row.plan as unknown as { name: string };

  const { price, cutCents } = await quote(admin, gymId, row.amount_cents, row.currency);
  const { error: priceError } = await admin
    .from('online_payments')
    .update({
      amount_cents: price.amountCents,
      base_cents: price.baseCents,
      charges_cents: price.chargesCents,
      cut_cents: cutCents,
    })
    .eq('id', paymentId);
  if (priceError) return json({ error: priceError.message }, 500);
  const charges = price.chargesCents
    ? ` (incl. ${row.currency === 'INR' ? '₹' : `${row.currency} `}${(price.chargesCents / 100).toFixed(2)} online payment charges)`
    : '';

  const giveUp = async (message: string, status: number) => {
    await admin.from('online_payments').update({ status: 'expired' }).eq('id', paymentId);
    return json({ error: message }, status);
  };

  // Real money must go to the owner, never sit with CoreFit Gym.
  if (isLiveMode() && !gym.razorpay_account_id) {
    return giveUp(
      "This gym's Razorpay account isn't linked yet. Please pay at the front desk.",
      400,
    );
  }

  const [{ data: profile }, { data: account }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', row.member_id).single(),
    admin.auth.admin.getUserById(row.member_id),
  ]);

  try {
    const link = await razorpay<{ id: string; short_url: string }>('/payment_links', {
      method: 'POST',
      body: {
        amount: price.amountCents,
        currency: row.currency,
        accept_partial: false,
        reference_id: paymentId,
        description: `${plan.name} membership · ${gym.name}${charges}`.slice(0, 2048),
        expire_by: Math.floor(Date.now() / 1000) + LINK_MINUTES * 60,
        customer: {
          name: profile?.full_name || undefined,
          email: account?.user?.email || undefined,
        },
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { online_payment_id: paymentId, gym_id: gymId },
        // Razorpay sends the member back here, which returns them to the app.
        callback_url: `${url}/functions/v1/razorpay-webhook`,
        callback_method: 'get',
      },
    });
    await admin
      .from('online_payments')
      .update({ razorpay_link_id: link.id, link_url: link.short_url })
      .eq('id', paymentId);
    return json({ paymentId, url: link.short_url, ...price });
  } catch (e) {
    console.error('payment link failed', e);
    return giveUp(
      `Couldn't open the payment page: ${e instanceof Error ? e.message : 'unknown error'}`,
      502,
    );
  }
});
