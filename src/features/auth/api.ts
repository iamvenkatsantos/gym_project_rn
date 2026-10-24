import type { Profile, Role } from '@/features/auth/types';
import { delay, mockProfiles } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type ProfileRow = {
  id: string;
  full_name: string;
  gyms: { role: Role; status: string; gym: { id: string; name: string } }[];
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    gyms: row.gyms
      .filter((g) => g.status === 'active')
      .map((g) => ({ gymId: g.gym.id, gymName: g.gym.name, role: g.role })),
  };
}

export async function fetchProfile(userId: string): Promise<Profile> {
  if (!supabase) {
    const profile = mockProfiles.find((p) => p.id === userId);
    if (!profile) throw new Error('Unknown user');
    return delay(profile);
  }
  const row = unwrap(
    await supabase
      .from('profiles')
      .select('id, full_name, gyms:gym_members(role, status, gym:gyms(id, name))')
      .eq('id', userId)
      .single(),
  ) as unknown as ProfileRow;
  return toProfile(row);
}

export async function signInWithPassword(email: string, password: string): Promise<Profile> {
  if (!supabase) throw new Error('Supabase is not configured. Use a demo role instead.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return fetchProfile(data.user.id);
}

/**
 * Creates an account. Returns the profile when the project signs people in
 * straight away, or null when they first have to confirm their email. Any gym
 * invites for that email are claimed once it's confirmed.
 */
export async function signUp(
  fullName: string,
  email: string,
  password: string,
): Promise<Profile | null> {
  if (!supabase) throw new Error('Supabase is not configured. Use a demo role instead.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data.session && data.user ? fetchProfile(data.user.id) : null;
}

/** Demo sign-in for mock mode: pick a role and get the seeded user who has it first. */
export async function signInAsDemo(role: Role): Promise<Profile> {
  const profile = mockProfiles.find((p) => p.gyms[0]?.role === role);
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
