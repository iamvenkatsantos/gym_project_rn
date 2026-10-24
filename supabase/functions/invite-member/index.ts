// Invites someone to a gym by email. The owner check and the invite itself run as
// the caller through invite_to_gym(); this function only adds the email, which
// needs the service role. Deploy with:
//   npx supabase functions deploy invite-member
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  const { gymId, email, role, redirectTo } = await req.json().catch(() => ({}));
  if (typeof gymId !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
    return json({ error: 'gymId, email and role are required' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: result, error } = await caller.rpc('invite_to_gym', {
    p_gym_id: gymId,
    p_email: email,
    p_role: role,
  });
  if (error) return json({ error: error.message }, 400);

  // Someone with a confirmed account was added straight away; there's nothing to accept.
  if (result !== 'invited') return json({ result, emailSent: false });

  // Supabase only follows redirect URLs on the project's allow list, so a bad one falls back
  // to the Site URL instead of sending people somewhere else.
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error: mailError } = await admin.auth.admin.inviteUserByEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: typeof redirectTo === 'string' ? redirectTo : undefined,
    },
  );
  // The invite is saved either way, so they can still join by creating an account.
  if (mailError) console.error('invite email failed', mailError.message);
  return json({ result, emailSent: !mailError, emailError: mailError?.message ?? null });
});
