// Invites someone to a gym by email, or with { inviteId } resends a pending invite's email
// (resend_gym_invite()). Role 'gym_owner' with a gymId invites the owner of a
// gym the admin just set up (admin_create_owner_gym); without one, it's the older invite to
// set up a gym of their own. The owner check and the invite itself run as the caller through
// invite_to_gym() / invite_gym_owner(); this function only adds the email, which
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
  gym_owner: {
    label: 'Gym owner',
    blurb:
      "Check your gym's details, then invite your members and trainers. Only your people see your gym.",
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** Says why an invite email didn't go, in words the inviter can act on. */
function mailErrorText(message: string) {
  const wait = message.match(/after (\d+) seconds?/i);
  if (wait) return `Wait ${wait[1]} seconds, then resend.`;
  if (/rate limit|too many/i.test(message)) {
    return 'Too many emails right now. Try again in an hour, or send it on WhatsApp.';
  }
  if (/already (been )?registered/i.test(message)) {
    return 'They already have an account. Ask them to sign in.';
  }
  return message;
}

type Clients = {
  caller: ReturnType<typeof createClient>;
  admin: ReturnType<typeof createClient>;
};

/**
 * Emails one invite with Supabase's invite template, as the first send and on Resend.
 * With a gymId it keeps to the cap in invite_email_wait() and records the try on the
 * invite, so the Invited list can say it failed.
 */
async function sendInviteEmail(
  { caller, admin }: Clients,
  {
    gymId,
    email,
    role,
    redirectTo,
  }: {
    gymId: string | null;
    email: string;
    role: string;
    redirectTo: unknown;
  },
): Promise<string | null> {
  const address = email.trim().toLowerCase();
  if (gymId) {
    const { data: wait } = await admin.rpc('invite_email_wait', {
      p_gym_id: gymId,
      p_email: address,
    });
    if (typeof wait === 'string' && wait) return wait;
  }

  // invite_to_gym / resend_gym_invite already refused unknown roles, so this only guards
  // the email's wording.
  const roleCopy = roles[role] ?? { label: role, blurb: '' };
  // The RPC already checked the caller may invite here, so the gym's name is read with the
  // service role: the admin belongs to no gym.
  const { data: gym } = gymId
    ? await admin.from('gyms').select('name').eq('id', gymId).maybeSingle()
    : { data: { name: 'your new gym' } };
  const {
    data: { user: inviter },
  } = await caller.auth.getUser();
  const { data: inviterProfile } = inviter
    ? await caller.from('profiles').select('full_name').eq('id', inviter.id).maybeSingle()
    : { data: null };
  // Stored as their user metadata; the invite template reads it as {{ .Data.* }}.
  const data = {
    gym_name: (gym as { name?: string } | null)?.name ?? 'your gym',
    invite_role: roleCopy.label,
    role_blurb: roleCopy.blurb,
    invited_by: (inviterProfile as { full_name?: string } | null)?.full_name || null,
    quote: quotes[Math.floor(Math.random() * quotes.length)],
  };

  // An earlier email already made their (unconfirmed) account. Supabase sends the invite
  // again with a new code but keeps the old details, so bring them up to date first.
  const { data: accountId } = await admin.rpc('invite_account_id', { p_email: address });
  if (typeof accountId === 'string') {
    await admin.auth.admin.updateUserById(accountId, { user_metadata: data });
  }

  // Supabase only follows redirect URLs on the project's allow list, so a bad one falls back
  // to the Site URL instead of sending people somewhere else.
  const { error: mailError } = await admin.auth.admin.inviteUserByEmail(address, {
    redirectTo: typeof redirectTo === 'string' ? redirectTo : undefined,
    data,
  });
  const failure = mailError ? mailErrorText(mailError.message) : null;
  if (mailError) console.error('invite email failed', mailError.message);
  if (gymId) {
    await admin.rpc('record_invite_email', {
      p_gym_id: gymId,
      p_email: address,
      p_error: failure,
    });
  }
  return failure;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authorization = req.headers.get('Authorization');
  if (!authorization) return json({ error: 'Unauthorized' }, 401);

  const { gymId, email, role, redirectTo, inviteId } = await req.json().catch(() => ({}));
  const url = Deno.env.get('SUPABASE_URL')!;
  const clients: Clients = {
    caller: createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
    }),
    admin: createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),
  };

  // Resend: the same invite again, with who invited them and their details kept.
  if (inviteId !== undefined) {
    if (typeof inviteId !== 'string' || !/^[0-9a-f-]{36}$/i.test(inviteId)) {
      return json({ error: 'inviteId is required' }, 400);
    }
    const { data: rows, error } = await clients.caller.rpc('resend_gym_invite', {
      p_invite_id: inviteId,
      p_channel: 'email',
    });
    if (error) return json({ error: error.message }, 400);
    const row = (
      rows as { gym_id: string; email: string; email_role: string; result: string }[]
    )[0];
    if (row.result !== 'invited') {
      return json({ result: row.result, emailSent: false, emailError: null, email: row.email });
    }
    const emailError = await sendInviteEmail(clients, {
      gymId: row.gym_id,
      email: row.email,
      role: row.email_role,
      redirectTo,
    });
    return json({ result: row.result, emailSent: !emailError, emailError, email: row.email });
  }

  const newGym = role === 'gym_owner';
  const setUpLater = newGym && typeof gymId !== 'string';
  if (
    (!newGym && typeof gymId !== 'string') ||
    typeof email !== 'string' ||
    typeof role !== 'string'
  ) {
    return json({ error: 'gymId, email and role are required' }, 400);
  }

  const { data: result, error } = setUpLater
    ? await clients.caller.rpc('invite_gym_owner', { p_email: email })
    : await clients.caller.rpc('invite_to_gym', {
        p_gym_id: gymId,
        p_email: email,
        p_role: newGym ? 'owner' : role,
      });
  if (error) return json({ error: error.message }, 400);

  // Someone with an account was added, or accepts in the app; there's nothing to email.
  if (result !== 'invited') return json({ result, emailSent: false, emailError: null });

  // The invite is saved either way, so a failed email can be resent from the Invited list.
  const emailError = await sendInviteEmail(clients, {
    gymId: setUpLater ? null : gymId,
    email,
    role,
    redirectTo,
  });
  return json({ result, emailSent: !emailError, emailError });
});
