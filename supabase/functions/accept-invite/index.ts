// Accepts a WhatsApp invite. The person types (or taps a link with) the code
// from the message, picks a name and password, and this function makes their
// account. Holding the code proves only that the message reached the phone the
// inviter typed, not that the person owns an email, so:
//   - Mobile sign-ins (<10 digits>@m.vinven.net, no inbox) are made already
//     confirmed, unless the number is tied to another gym (an invite there, or
//     an unconfirmed account at one): confirming claims every invite for the
//     address, so that would hand over the other gym's invite.
//   - Real emails get the usual sign-up code in their inbox instead. The account
//     is made unconfirmed with no password (or an imported / emailed-invite one
//     is left as it is), and the app sets the password once the code checks out.
// Confirming fires the claim trigger, which adds them to the gym and deletes the
// invite, so a code works once. Deploy with:
//   npx supabase functions deploy accept-invite
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Account = { email: string; phone: string | null; user_id: string | null; confirmed: boolean };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// The app checks these too; this keeps a hand-made request to the same rules.
function badPassword(password: string) {
  return (
    password.length < 8 ||
    password.length > 72 ||
    /^\s|\s$/.test(password) ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const body = await req.json().catch(() => ({}));
  // Codes are 8 letters and digits; anything far longer isn't one, so skip the lookup.
  const code = typeof body.code === 'string' && body.code.length <= 20 ? body.code : '';
  const fullName =
    typeof body.fullName === 'string' ? body.fullName.trim().replace(/\s+/g, ' ') : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!code) return json({ error: 'Enter your invite code.' }, 400);
  if (fullName.length < 2 || fullName.length > 60) return json({ error: 'Enter your name.' }, 400);
  if (badPassword(password)) {
    return json({ error: 'Use 8+ characters with letters and a number.' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await admin.rpc('invite_code_account', { p_code: code });
  if (error) return json({ error: error.message }, 500);
  const account = (data as Account[])[0];
  if (!account)
    return json({ error: 'Code not found or expired. Ask the gym for a new one.' }, 404);
  const mobileLogin = account.email.endsWith('@m.vinven.net');
  if (account.confirmed) {
    // Invites without an email sign in with the mobile number (see mobile_login_email()).
    const signInWith = mobileLogin ? 'your mobile number' : account.email;
    return json({ error: `You already have an account. Sign in with ${signInWith}.` }, 409);
  }

  if (!mobileLogin) {
    // A real email: prove it's theirs with the code from that inbox. Never set a
    // password or confirm here, or whoever holds the WhatsApp code owns the email.
    if (account.user_id) {
      // Imported, or invited by email: ask for a password once they confirm.
      const { error: flagError } = await admin.auth.admin.updateUserById(account.user_id, {
        app_metadata: { imported: true },
      });
      if (flagError) return json({ error: flagError.message }, 400);
    } else {
      const { error: createError } = await admin.auth.admin.createUser({
        email: account.email,
        email_confirm: false,
        user_metadata: { full_name: fullName },
        app_metadata: { imported: true },
      });
      if (createError) return json({ error: createError.message }, 400);
    }
    const { error: sendError } = await admin.auth.resend({ type: 'signup', email: account.email });
    if (sendError) return json({ error: sendError.message }, 400);
    return json({ email: account.email, emailCode: true });
  }

  const { data: conflict, error: conflictError } = await admin.rpc('invite_code_conflict', {
    p_code: code,
  });
  if (conflictError) return json({ error: conflictError.message }, 500);
  if (conflict) {
    return json(
      {
        error:
          'This number has an invite from another gym too. Ask the gym to contact CoreFit support.',
      },
      409,
    );
  }

  let userId = account.user_id;
  if (userId) {
    // Imported at this gym and never confirmed: take the account over.
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { imported: false },
    });
    if (updateError) return json({ error: updateError.message }, 400);
  } else {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError) return json({ error: createError.message }, 400);
    userId = created.user.id;
  }

  // The profile row may predate this name (imported members); fill it if empty.
  await admin
    .from('profiles')
    .update({ full_name: fullName })
    .eq('id', userId)
    .or('full_name.is.null,full_name.eq.');
  // The number the invite went to, unless they've saved one already.
  if (account.phone) {
    const phone = account.phone.replace(/^\+91/, '');
    await admin
      .from('contact_details')
      .upsert({ user_id: userId, phone }, { onConflict: 'user_id', ignoreDuplicates: true });
  }

  return json({ email: account.email });
});
