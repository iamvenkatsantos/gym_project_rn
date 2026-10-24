// Pushes new inbox rows to the recipients' phones through Expo's push service.
// Called by the notifications_push trigger (pg_net), never by the app, so it
// checks a shared secret instead of a user's JWT. Deploy with:
//   npx supabase functions deploy send-push --no-verify-jwt
// and set PUSH_WEBHOOK_SECRET (and optionally EXPO_ACCESS_TOKEN) as secrets.
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Expo takes at most 100 messages per request.
const BATCH = 100;

type Notification = {
  id: string;
  gym_id: string;
  recipient_id: string;
  kind: string;
  title: string;
  body: string;
  class_id: string | null;
};

type Ticket = { status: 'ok' | 'error'; message?: string; details?: { error?: string } };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-push-secret') !== secret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0) return json({ error: 'ids are required' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: notifications, error } = await admin
    .from('notifications')
    .select('id, gym_id, recipient_id, kind, title, body, class_id')
    .in('id', ids);
  if (error) return json({ error: error.message }, 500);
  if (!notifications?.length) return json({ sent: 0 });

  const recipients = [...new Set(notifications.map((n: Notification) => n.recipient_id))];
  const [{ data: tokens }, { data: unread }] = await Promise.all([
    admin.from('push_tokens').select('token, user_id').in('user_id', recipients),
    // The app icon badge shows everything still unread, across gyms.
    admin
      .from('notifications')
      .select('recipient_id')
      .in('recipient_id', recipients)
      .is('read_at', null)
      .limit(5000),
  ]);
  if (!tokens?.length) return json({ sent: 0 });

  const badge = new Map<string, number>();
  for (const row of unread ?? []) {
    badge.set(row.recipient_id, (badge.get(row.recipient_id) ?? 0) + 1);
  }

  const messages = notifications.flatMap((n: Notification) =>
    tokens
      .filter((t) => t.user_id === n.recipient_id)
      .map((t) => ({
        to: t.token,
        title: n.title,
        body: n.body || undefined,
        sound: 'default',
        badge: badge.get(n.recipient_id) ?? 1,
        channelId: 'default',
        priority: 'high',
        // The app reads these when the notification is tapped.
        data: { notificationId: n.id, gymId: n.gym_id, kind: n.kind, classId: n.class_id },
      })),
  );

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let sent = 0;
  const deadTokens: string[] = [];
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error('expo push failed', res.status, await res.text());
      continue;
    }
    const { data: tickets } = (await res.json()) as { data: Ticket[] };
    tickets.forEach((ticket, j) => {
      if (ticket.status === 'ok') sent += 1;
      // The app was uninstalled or the token was revoked; stop sending to it.
      else if (ticket.details?.error === 'DeviceNotRegistered') deadTokens.push(batch[j].to);
      else console.error('expo push ticket error', ticket.message);
    });
  }

  if (deadTokens.length) await admin.from('push_tokens').delete().in('token', deadTokens);
  return json({ sent, removed: deadTokens.length });
});
