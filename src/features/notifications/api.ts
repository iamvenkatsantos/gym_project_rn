import type { AppNotification, TrainerMessageInput } from '@/features/notifications/types';
import { delay, forGym, mockId, mockNotifications, mockProfiles } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type NotificationRow = {
  id: string;
  recipient_id: string;
  kind: AppNotification['kind'];
  title: string;
  body: string;
  class_id: string | null;
  created_at: string;
  read_at: string | null;
  sender: { full_name: string } | null;
};

/** The signed-in person's inbox at this gym, newest first. */
export async function listNotifications(
  gymId: string,
  recipientId: string,
): Promise<AppNotification[]> {
  if (!supabase) {
    return delay(forGym(gymId, mockNotifications).filter((n) => n.recipientId === recipientId));
  }
  const rows = unwrap(
    await supabase
      .from('notifications')
      .select(
        'id, recipient_id, kind, title, body, class_id, created_at, read_at, sender:profiles!notifications_sender_id_fkey(full_name)',
      )
      .eq('gym_id', gymId)
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(50),
  ) as unknown as NotificationRow[];
  return rows.map((r) => ({
    id: r.id,
    recipientId: r.recipient_id,
    senderName: r.sender?.full_name ?? null,
    kind: r.kind,
    title: r.title,
    body: r.body,
    classId: r.class_id,
    createdAt: r.created_at,
    readAt: r.read_at,
  }));
}

export async function markAllRead(gymId: string, recipientId: string) {
  const now = new Date().toISOString();
  if (!supabase) {
    for (const n of mockNotifications) {
      if (n.recipientId === recipientId && !n.readAt) n.readAt = now;
    }
    return delay(undefined);
  }
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: now })
    .eq('gym_id', gymId)
    .eq('recipient_id', recipientId)
    .is('read_at', null);
  if (error) throw error;
}

/** Owners and supervisors nudge a trainer, e.g. to schedule or follow up on a class. */
export async function messageTrainer(gymId: string, senderId: string, input: TrainerMessageInput) {
  if (!supabase) {
    mockNotifications.unshift({
      id: mockId('n'),
      recipientId: input.trainerId,
      senderName: mockProfiles.find((p) => p.id === senderId)?.fullName ?? null,
      kind: 'message',
      title: input.title.trim(),
      body: input.body.trim(),
      classId: input.classId,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    return delay(undefined);
  }
  const { error } = await supabase.rpc('message_trainer', {
    p_gym_id: gymId,
    p_trainer_id: input.trainerId,
    p_title: input.title,
    p_body: input.body,
    p_class_id: input.classId,
  });
  if (error) throw error;
}
