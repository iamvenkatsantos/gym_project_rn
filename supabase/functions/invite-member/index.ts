// Invites someone to a gym by email. The owner check and the invite itself run as
// the caller through invite_to_gym(); this function only adds the email, which
// needs the service role. Deploy with:
//   npx supabase functions deploy invite-member
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// One goes in each invite email (the template shows it as {{ .Data.quote }}).
const quotes = [
  'Strong is built one rep at a time.',
  'The hardest part is showing up. You just did.',
  'Small steps every day add up to big results.',
  'Your only competition is who you were yesterday.',
  'Progress, not perfection.',
  'Every workout counts, especially the first one.',
  'Discipline is choosing what you want most over what you want now.',
  'Sweat now, shine later.',
];

const roles: Record<string, { label: string; blurb: string }> = {
  member: {
    label: 'Member',
    blurb: 'Book classes, follow your workout plan and keep your membership in one place.',
  },
  trainer: {
    label: 'Trainer',
    blurb: "See your schedule, build workout plans and follow your members' progress.",
  },
  supervisor: {
    label: 'Supervisor',
    blurb: 'Record payments, invite people and match members with the right trainer.',
  },
  owner: {
    label: 'Co-owner',
    blurb: 'Run members, classes and memberships for the gym from your phone.',
  },
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
  if (result !== 'invited') return json({ result, emailSent: false, emailError: null });

  // Details for the email template, read as the owner so RLS still applies.
  const { data: gym } = await caller.from('gyms').select('name').eq('id', gymId).maybeSingle();
  const {
    data: { user: owner },
  } = await caller.auth.getUser();
  const { data: ownerProfile } = owner
    ? await caller.from('profiles').select('full_name').eq('id', owner.id).maybeSingle()
    : { data: null };

  // Supabase only follows redirect URLs on the project's allow list, so a bad one falls back
  // to the Site URL instead of sending people somewhere else.
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error: mailError } = await admin.auth.admin.inviteUserByEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: typeof redirectTo === 'string' ? redirectTo : undefined,
      // Stored as their user metadata; the invite template reads it as {{ .Data.* }}.
      data: {
        gym_name: gym?.name ?? 'your gym',
        invite_role: (roles[role] ?? roles.member).label,
        role_blurb: (roles[role] ?? roles.member).blurb,
        invited_by: ownerProfile?.full_name || null,
        quote: quotes[Math.floor(Math.random() * quotes.length)],
      },
    },
  );
  // The invite is saved either way, so they can still join by creating an account.
  if (mailError) console.error('invite email failed', mailError.message);
  return json({ result, emailSent: !mailError, emailError: mailError?.message ?? null });
});
