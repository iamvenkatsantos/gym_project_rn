// Accepts a WhatsApp invite. The person types (or taps a link with) the code
// from the message, picks a name and password, and this function makes their
// account already confirmed: holding the code proves the invite reached them,
// so there's no email code to wait for. Confirming fires the claim trigger,
// which adds them to the gym and deletes the invite, so a code works once.
// An imported member's account (made unconfirmed by import-members) is taken
// over the same way. The app then signs in with the email and password.
// Deploy with:
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
  const code = typeof body.code === 'string' ? body.code : '';
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
  if (account.confirmed) {
    return json({ error: `You already have an account. Sign in with ${account.email}.` }, 409);
  }

  let userId = account.user_id;
  if (userId) {
    // Imported, or invited by email and never confirmed: take the account over.
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
