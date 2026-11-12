import type { GymInvite, MovedMember } from '@/features/gym-invites/types';
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
  leaving_gyms?: string | null;
  days_left?: number | null;
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
    leavingGyms: r.leaving_gyms ?? null,
    daysLeft: r.days_left ?? 0,
  }));
}

type MovedRow = {
  user_id: string;
  full_name: string;
  phone: string | null;
  moved_at: string | null;
  days_left: number;
};

/** People who moved out of this gym by joining another, newest first. */
export async function listMovedMembers(gymId: string): Promise<MovedMember[]> {
  if (!supabase) return delay([]);
  const rows = unwrap(await supabase.rpc('gym_moved_members', { p_gym_id: gymId })) as MovedRow[];
  return rows.map((r) => ({
    userId: r.user_id,
    fullName: r.full_name || 'Unnamed',
    phone: r.phone,
    movedAt: r.moved_at,
    daysLeft: r.days_left,
  }));
}

/** Joins the gym. With `shareHistory` its coaches see what they logged at other gyms. */
export async function acceptGymInvite(inviteId: string, shareHistory: boolean): Promise<string> {
  if (!supabase) return delay(inviteId);
  return unwrap(
    await supabase.rpc('accept_gym_invite', {
      p_invite_id: inviteId,
      p_share_history: shareHistory,
    }),
  ) as string;
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
