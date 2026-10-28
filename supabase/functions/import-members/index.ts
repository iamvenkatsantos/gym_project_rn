// Imports members from the owner's spreadsheet. Making an account for an email
// needs the service role, so this function does that part: an unconfirmed
// account with no email sent, which the member takes over when they accept
// their invite. Everything else (the owner check, adding them to the gym,
// their mobile number and membership) runs as the caller through
// import_members(). Invite emails go out afterwards through invite-member.
// Deploy with:
//   npx supabase functions deploy import-members
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The app sends rows in chunks this size, which keeps each call well inside the time limit.
const MAX_ROWS = 50;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Row = { email?: unknown; name?: unknown };
type Outcome = { email: string; result: string; joined: boolean; message: string | null };

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

  const { gymId, rows } = await req.json().catch(() => ({}));
  if (typeof gymId !== 'string' || !Array.isArray(rows)) {
    return json({ error: 'gymId and rows are required' }, 400);
  }
  if (rows.length > MAX_ROWS)
    return json({ error: `Send at most ${MAX_ROWS} rows at a time` }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });

  // An empty import runs only the owner check, before any account is made.
  const check = await caller.rpc('import_members', { p_gym_id: gymId, p_rows: [] });
  if (check.error) return json({ error: check.error.message }, 403);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const failed = new Map<string, string>();
  const emails = new Map<string, string>();
  for (const row of rows as Row[]) {
    const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
    if (EMAIL.test(email) && !emails.has(email)) {
      emails.set(email, typeof row.name === 'string' ? row.name.trim().slice(0, 60) : '');
    }
  }

  // A few at a time, so a big file doesn't hit Auth's rate limit all at once.
  const pending = [...emails];
  while (pending.length) {
    await Promise.all(
      pending.splice(0, 5).map(async ([email, fullName]) => {
        const { error } = await admin.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: fullName ? { full_name: fullName } : {},
        });
        // Someone with an account already is fine: import_members() finds them.
        if (
          error &&
          error.code !== 'email_exists' &&
          !/already been registered/i.test(error.message)
        ) {
          failed.set(email, error.message);
        }
      }),
    );
  }

  const { data, error } = await caller.rpc('import_members', { p_gym_id: gymId, p_rows: rows });
  if (error) return json({ error: error.message }, 400);

  const results = (data as Outcome[]).map((r) =>
    r.result === 'skipped' && failed.has(r.email)
      ? { ...r, message: `Couldn't make an account: ${failed.get(r.email)}` }
      : r,
  );
  return json({ results });
});
