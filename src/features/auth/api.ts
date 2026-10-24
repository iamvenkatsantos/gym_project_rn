import type { Profile, Role } from '@/features/auth/types';
import { delay, mockProfiles } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type ProfileRow = { id: string; gym_id: string | null; full_name: string; role: Role };

function toProfile(row: ProfileRow): Profile {
  return { id: row.id, gymId: row.gym_id, fullName: row.full_name, role: row.role };
}

export async function fetchProfile(userId: string): Promise<Profile> {
  if (!supabase) {
    const profile = mockProfiles.find((p) => p.id === userId);
    if (!profile) throw new Error('Unknown user');
    return delay(profile);
  }
  const row = unwrap(
    await supabase.from('profiles').select('id, gym_id, full_name, role').eq('id', userId).single(),
  );
  return toProfile(row);
}

export async function signInWithPassword(email: string, password: string): Promise<Profile> {
  if (!supabase) throw new Error('Supabase is not configured. Use a demo role instead.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return fetchProfile(data.user.id);
}

/** Demo sign-in for mock mode: pick a role and get that seeded user. */
export async function signInAsDemo(role: Role): Promise<Profile> {
  const profile = mockProfiles.find((p) => p.role === role);
  if (!profile) throw new Error(`No demo ${role}`);
  return delay(profile);
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/**
 * Permanently deletes the signed-in user's account and data. Required by both
 * App Store (5.1.1(v)) and Google Play for apps that let people sign up.
 */
export async function deleteAccount() {
  if (!supabase) return delay(undefined);
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await supabase.auth.signOut();
}

export async function restoreProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ? fetchProfile(data.session.user.id) : null;
}
