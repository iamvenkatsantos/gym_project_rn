// Deletes the calling user's auth account. Their profile, bookings, memberships
// and workouts cascade from auth.users; progress photo files are removed first
// (the app already removes profile photos). Deploy with:
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

  // Files don't cascade with their rows, and the privacy policy promises they go.
  const { data: photos, error: photosError } = await admin
    .from('progress_photos')
    .select('storage_path')
    .eq('member_id', user.id);
  if (photosError) return new Response(photosError.message, { status: 500 });
  const paths = (photos ?? []).map((p: { storage_path: string }) => p.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await admin.storage.from('progress-photos').remove(paths.slice(i, i + 100));
    if (error) return new Response(error.message, { status: 500 });
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return new Response(error.message, { status: 500 });

  return new Response(null, { status: 204 });
});
