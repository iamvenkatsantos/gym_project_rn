// Starts an owner's payment for a year of CoreFit Gym at one branch and returns
// Razorpay's payment page for it. The money is CoreFit Gym's own, so it stays in
// our Razorpay account (no Route transfer). razorpay-webhook confirms it, which
// moves the branch's paid_until on by a year.
// Deploy with:
//   npx supabase functions deploy create-subscription-payment
import { createClient } from 'npm:@supabase/supabase-js@2';

import { adminClient, razorpay } from '../_shared/razorpay.ts';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Unauthorized' }, 401);

  const { gymId } = await req.json().catch(() => ({}));
  if (typeof gymId !== 'string') return json({ error: 'gymId is required' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });

  // Checks the caller owns the branch, there's something to pay and it's due.
  const { data: paymentId, error } = await caller.rpc('start_subscription_payment', {
    p_gym_id: gymId,
  });
  if (error) return json({ error: error.message }, 400);

  const admin = adminClient();
  const { data: row, error: readError } = await admin
    .from('subscription_payments')
    .select('id, amount_cents, currency, paid_by, gym:gyms(name)')
    .eq('id', paymentId)
    .single();
  if (readError) return json({ error: readError.message }, 500);
  const gym = row.gym as unknown as { name: string };

  const [{ data: profile }, { data: account }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', row.paid_by).single(),
    admin.auth.admin.getUserById(row.paid_by),
  ]);

  try {
    const link = await razorpay<{ id: string; short_url: string }>('/payment_links', {
      method: 'POST',
      body: {
        amount: row.amount_cents,
        currency: row.currency,
        accept_partial: false,
        reference_id: paymentId,
        description: `CoreFit Gym yearly plan · ${gym.name}`.slice(0, 2048),
        expire_by: Math.floor(Date.now() / 1000) + LINK_MINUTES * 60,
        customer: {
          name: profile?.full_name || undefined,
          email: account?.user?.email || undefined,
        },
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { subscription_payment_id: paymentId, gym_id: gymId },
        callback_url: `${url}/functions/v1/razorpay-webhook`,
        callback_method: 'get',
      },
    });
    await admin
      .from('subscription_payments')
      .update({ razorpay_link_id: link.id, link_url: link.short_url })
      .eq('id', paymentId);
    return json({ paymentId, url: link.short_url });
  } catch (e) {
    console.error('subscription link failed', e);
    await admin.from('subscription_payments').update({ status: 'expired' }).eq('id', paymentId);
    return json(
      {
        error: `Couldn't open the payment page: ${e instanceof Error ? e.message : 'unknown error'}`,
      },
      502,
    );
  }
});
