// Resets the password of a mobile sign-in with a one-time code from the gym.
// People invited on WhatsApp without an email have no inbox for a reset email,
// so an owner or supervisor makes a code (create_password_reset_code(), person
// screen → Reset password) and sends it on WhatsApp. The person enters it with
// a new password here; the code is deleted, so it works once. The app then
// signs in with the account's email and the new password.
// Deploy with:
//   npx supabase functions deploy reset-password
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

// Same rule as accept-invite and the app.
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
  const password = typeof body.password === 'string' ? body.password : '';
  if (!code) return json({ error: 'Enter your reset code.' }, 400);
  if (badPassword(password)) {
    return json({ error: 'Use 8+ characters with letters and a number.' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data, error } = await admin.rpc('reset_code_account', { p_code: code });
  if (error) return json({ error: error.message }, 500);
  const account = (data as { user_id: string; email: string }[])[0];
  if (!account)
    return json({ error: 'Code not found or expired. Ask your gym for a new one.' }, 404);

  const { error: updateError } = await admin.auth.admin.updateUserById(account.user_id, {
    password,
  });
  if (updateError) return json({ error: updateError.message }, 400);
  await admin.from('password_reset_codes').delete().eq('user_id', account.user_id);
  // Sign them out everywhere else (a lost or shared phone); the app signs in fresh next.
  const { error: sessionsError } = await admin.rpc('end_user_sessions', {
    p_user_id: account.user_id,
  });
  if (sessionsError) console.error('end_user_sessions failed', sessionsError.message);

  return json({ email: account.email });
});
