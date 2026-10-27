// Confirms Razorpay payments. Two ways in, both signature-checked:
//   POST: Razorpay's webhook (payment_link.paid, .expired, .cancelled), signed
//         with RAZORPAY_WEBHOOK_SECRET. This is what records a payment.
//   GET:  the member's browser coming back from the payment page, signed with
//         RAZORPAY_KEY_SECRET. Records the payment too if the webhook is slow,
//         then sends the member back to the app.
// Razorpay calls it without a Supabase login, so deploy with:
//   npx supabase functions deploy razorpay-webhook --no-verify-jwt
import {
  adminClient,
  completePayment,
  hmacHex,
  keySecret,
  safeEqual,
} from '../_shared/razorpay.ts';

// Where the app listens for the end of a payment (app.json "scheme").
const APP_RETURN_URL = Deno.env.get('APP_RETURN_URL') ?? 'corefit://payment-return';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PaymentEntity = { id: string; amount: number; fee: number | null; status: string };
type LinkEntity = { id: string; reference_id: string; status: string };

type WebhookEvent = {
  event: string;
  payload: {
    payment_link?: { entity: LinkEntity };
    payment?: { entity: PaymentEntity };
  };
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleWebhook(req: Request) {
  const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  const raw = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  if (!secret || !safeEqual(await hmacHex(secret, raw), signature)) {
    return json({ error: 'Bad signature' }, 401);
  }

  const event = JSON.parse(raw) as WebhookEvent;
  const link = event.payload.payment_link?.entity;
  // Only links from create-payment carry our payment's id; anything else, such as a
  // link made by hand in the Razorpay dashboard, isn't ours to handle.
  if (!link?.reference_id || !UUID.test(link.reference_id)) return json({ ignored: event.event });

  const admin = adminClient();
  const { data: ours } = await admin
    .from('online_payments')
    .select('id')
    .eq('id', link.reference_id)
    .maybeSingle();
  if (!ours) return json({ ignored: event.event });
  if (event.event === 'payment_link.paid') {
    const payment = event.payload.payment?.entity;
    if (!payment) return json({ error: 'No payment in event' }, 400);
    try {
      await completePayment(admin, link.reference_id, payment);
    } catch (e) {
      // A 500 makes Razorpay retry, which is what we want for a database hiccup.
      console.error('complete payment failed', link.reference_id, e);
      return json({ error: e instanceof Error ? e.message : 'failed' }, 500);
    }
    return json({ ok: true });
  }

  if (event.event === 'payment_link.expired' || event.event === 'payment_link.cancelled') {
    await admin
      .from('online_payments')
      .update({ status: 'expired' })
      .eq('id', link.reference_id)
      .eq('status', 'created');
    return json({ ok: true });
  }

  return json({ ignored: event.event });
}

async function handleReturn(url: URL) {
  const p = (name: string) => url.searchParams.get(name) ?? '';
  const paymentId = p('razorpay_payment_id');
  const linkId = p('razorpay_payment_link_id');
  const reference = p('razorpay_payment_link_reference_id');
  const status = p('razorpay_payment_link_status');

  if (paymentId && status === 'paid' && UUID.test(reference)) {
    const expected = await hmacHex(keySecret(), `${linkId}|${reference}|${status}|${paymentId}`);
    if (safeEqual(expected, p('razorpay_signature'))) {
      try {
        // The amount and fee come from Razorpay, not from the URL.
        await completePayment(adminClient(), reference, {
          id: paymentId,
          amount: 0,
          fee: null,
          status,
        });
      } catch (e) {
        // The webhook will record it; the app keeps checking until it has.
        console.error('return completion failed', reference, e);
      }
    }
  }

  const back = new URL(APP_RETURN_URL);
  if (reference) back.searchParams.set('paymentId', reference);
  return new Response(null, { status: 302, headers: { Location: back.toString() } });
}

Deno.serve(async (req) => {
  if (req.method === 'POST') return handleWebhook(req);
  if (req.method === 'GET') return handleReturn(new URL(req.url));
  return json({ error: 'Method not allowed' }, 405);
});
