import type { Role } from '@/features/auth/types';
import { visibleTo } from '@/features/announcements/rules';
import type { Announcement, AnnouncementInput, SavedOffer } from '@/features/announcements/types';
import {
  delay,
  forGym,
  mockAnnouncements,
  mockId,
  mockProfiles,
  mockSavedOffers,
} from '@/lib/mock-db';
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

/** Offers saved for reuse, newest first. Only owners and supervisors see them. */
export async function listSavedOffers(gymId: string): Promise<SavedOffer[]> {
  if (!supabase) return delay(forGym(gymId, mockSavedOffers));
  const rows = unwrap(
    await supabase
      .from('saved_offers')
      .select('id, audience, title, body')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false }),
  ) as SavedOffer[];
  return rows;
}

export async function saveOffer(gymId: string, senderId: string, input: AnnouncementInput) {
  const offer = { audience: input.audience, title: input.title.trim(), body: input.body.trim() };
  if (!supabase) {
    mockSavedOffers.unshift({ id: mockId('so'), ...offer });
    return delay(undefined);
  }
  const { error } = await supabase
    .from('saved_offers')
    .insert({ ...offer, gym_id: gymId, created_by: senderId });
  if (error) throw error;
}

export async function deleteSavedOffer(id: string) {
  if (!supabase) {
    const i = mockSavedOffers.findIndex((o) => o.id === id);
    if (i >= 0) mockSavedOffers.splice(i, 1);
    return delay(undefined);
  }
  const { error } = await supabase.from('saved_offers').delete().eq('id', id);
  if (error) throw error;
}
