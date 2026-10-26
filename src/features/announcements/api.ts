import type { Role } from '@/features/auth/types';
import { visibleTo } from '@/features/announcements/rules';
import type { Announcement, AnnouncementInput } from '@/features/announcements/types';
import { delay, forGym, mockAnnouncements, mockId, mockProfiles } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type AnnouncementRow = {
  id: string;
  audience: Announcement['audience'];
  title: string;
  body: string;
  created_at: string;
  sender: { full_name: string } | null;
};

/** The gym's announcements the signed-in person can see, newest first. The server filters by role. */
export async function listAnnouncements(gymId: string, role: Role): Promise<Announcement[]> {
  if (!supabase) return delay(visibleTo(forGym(gymId, mockAnnouncements), role));
  const rows = unwrap(
    await supabase
      .from('announcements')
      .select(
        'id, audience, title, body, created_at, sender:profiles!announcements_sender_id_fkey(full_name)',
      )
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(50),
  ) as unknown as AnnouncementRow[];
  return rows.map((r) => ({
    id: r.id,
    senderName: r.sender?.full_name ?? null,
    audience: r.audience,
    title: r.title,
    body: r.body,
    createdAt: r.created_at,
  }));
}

/** Posts an announcement; everyone it's for gets it in their inbox and as a push. */
export async function sendAnnouncement(gymId: string, senderId: string, input: AnnouncementInput) {
  if (!supabase) {
    mockAnnouncements.unshift({
      id: mockId('a'),
      senderName: mockProfiles.find((p) => p.id === senderId)?.fullName ?? null,
      audience: input.audience,
      title: input.title.trim(),
      body: input.body.trim(),
      createdAt: new Date().toISOString(),
    });
    return delay(undefined);
  }
  const { error } = await supabase.rpc('send_announcement', {
    p_gym_id: gymId,
    p_audience: input.audience,
    p_title: input.title,
    p_body: input.body,
  });
  if (error) throw error;
}

/** Takes an announcement off the list. Copies already in people's inboxes stay. */
export async function deleteAnnouncement(id: string) {
  if (!supabase) {
    const i = mockAnnouncements.findIndex((a) => a.id === id);
    if (i >= 0) mockAnnouncements.splice(i, 1);
    return delay(undefined);
  }
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}
