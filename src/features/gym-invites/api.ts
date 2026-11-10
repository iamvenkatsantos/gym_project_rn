import type { GymInvite } from '@/features/gym-invites/types';
import { delay } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type InviteRow = {
  id: string;
  gym_id: string;
  gym_name: string;
  gym_city: string | null;
  role: GymInvite['role'];
  invited_by_name: string | null;
  created_at: string;
};

/** Gyms that invited the signed-in person's account and that they haven't joined yet. */
export async function listMyGymInvites(): Promise<GymInvite[]> {
  if (!supabase) return delay([]);
  const rows = unwrap(await supabase.rpc('my_gym_invites')) as InviteRow[];
  return rows.map((r) => ({
    id: r.id,
    gymId: r.gym_id,
    gymName: r.gym_name,
    gymCity: r.gym_city,
    role: r.role,
    invitedByName: r.invited_by_name,
    createdAt: r.created_at,
  }));
}

/** Joins the gym. With `shareHistory` its coaches see what they logged at other gyms. */
export async function acceptGymInvite(inviteId: string, shareHistory: boolean) {
  if (!supabase) return delay(undefined);
  const { error } = await supabase.rpc('accept_gym_invite', {
    p_invite_id: inviteId,
    p_share_history: shareHistory,
  });
  if (error) throw error;
}

export async function declineGymInvite(inviteId: string) {
  if (!supabase) return delay(undefined);
  const { error } = await supabase.rpc('decline_gym_invite', { p_invite_id: inviteId });
  if (error) throw error;
}

/** Whether this gym's coaches may see what the person logged at their other gyms. */
export async function getHistorySharing(gymId: string, userId: string): Promise<boolean> {
  if (!supabase) return delay(false);
  const { data, error } = await supabase
    .from('gym_members')
    .select('history_shared')
    .eq('gym_id', gymId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as { history_shared: boolean } | null)?.history_shared === true;
}

export async function setHistorySharing(gymId: string, share: boolean) {
  if (!supabase) return delay(undefined);
  const { error } = await supabase.rpc('set_history_sharing', {
    p_gym_id: gymId,
    p_share: share,
  });
  if (error) throw error;
}
