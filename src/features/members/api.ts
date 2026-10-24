import type { GymMember } from '@/features/members/types';
import { delay, forGym, mockMembers } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type MemberRow = { user_id: string; profile: { full_name: string } };

/** Active members of a gym, by name. Staff of the gym can read this. */
export async function listGymMembers(gymId: string): Promise<GymMember[]> {
  if (!supabase) return delay(forGym(gymId, mockMembers));
  const rows = unwrap(
    await supabase
      .from('gym_members')
      .select('user_id, profile:profiles(full_name)')
      .eq('gym_id', gymId)
      .eq('role', 'member')
      .eq('status', 'active'),
  ) as unknown as MemberRow[];
  return rows
    .map((r) => ({ id: r.user_id, fullName: r.profile.full_name }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
