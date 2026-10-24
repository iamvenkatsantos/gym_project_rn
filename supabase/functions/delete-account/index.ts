// Deletes the calling user's auth account. Their profile, bookings, memberships
// and workouts cascade from auth.users. Deploy with:
//   npx supabase functions deploy delete-account
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return new Response('Unauthorized', { status: 401 });

  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) return new Response('Unauthorized', { status: 401 });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return new Response(error.message, { status: 500 });

  return new Response(null, { status: 204 });
});
