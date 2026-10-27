// Starts an online payment for a membership plan and returns Razorpay's payment
// page for it. The member checks out there (UPI, cards, netbanking); the payment
// only counts once razorpay-webhook confirms it. Deploy with:
//   npx supabase functions deploy create-payment
import { createClient } from 'npm:@supabase/supabase-js@2';

import { adminClient, isLiveMode, razorpay } from '../_shared/razorpay.ts';

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

  const { gymId, planId } = await req.json().catch(() => ({}));
  if (typeof gymId !== 'string' || typeof planId !== 'string') {
    return json({ error: 'gymId and planId are required' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
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
        amount: row.amount_cents,
        currency: row.currency,
        accept_partial: false,
        reference_id: paymentId,
        description: `${plan.name} membership · ${gym.name}`.slice(0, 2048),
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
    return json({ paymentId, url: link.short_url });
  } catch (e) {
    console.error('payment link failed', e);
    return giveUp(
      `Couldn't open the payment page: ${e instanceof Error ? e.message : 'unknown error'}`,
      502,
    );
  }
});
