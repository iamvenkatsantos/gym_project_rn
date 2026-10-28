import * as Linking from 'expo-linking';

import type { LinkSession } from '@/features/auth/auth-link';
import type { Profile, Role } from '@/features/auth/types';
import { delay, mockProfiles } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type ProfileRow = {
  id: string;
  full_name: string;
  gyms: {
    role: Role;
    status: string;
    onboarded_at: string | null;
    gym: { id: string; name: string; brand: { id: string; name: string } | null };
  }[];
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    gyms: row.gyms
      .filter((g) => g.status === 'active')
      .map((g) => ({
        gymId: g.gym.id,
        gymName: g.gym.name,
        role: g.role,
        brandId: g.gym.brand?.id,
        brandName: g.gym.brand?.name,
        needsOnboarding: g.role === 'member' && g.onboarded_at === null,
      })),
  };
}

export async function fetchProfile(userId: string): Promise<Profile> {
  if (!supabase) {
    const profile = mockProfiles.find((p) => p.id === userId);
    if (!profile) throw new Error('Unknown user');
    return delay(profile);
  }
  const client = supabase;
  const selectProfile = (gymColumns: string) =>
    client
      .from('profiles')
      .select(
        `id, full_name, gyms:gym_members!gym_members_user_id_fkey(${gymColumns}, gym:gyms(id, name, brand:brands(id, name)))`,
      )
      .eq('id', userId)
      .single();
  const [withOnboarding, adminResult] = await Promise.all([
    selectProfile('role, status, onboarded_at'),
    client.rpc('is_platform_admin'),
  ]);
  // Before the member onboarding migration there's no onboarded_at; nobody is asked yet.
  const profileResult =
    withOnboarding.error?.code === '42703' ? await selectProfile('role, status') : withOnboarding;
  const row = unwrap(profileResult) as unknown as ProfileRow;
  // Before the platform_admins migration the check fails; then nobody is an admin.
  return { ...toProfile(row), isPlatformAdmin: adminResult.data === true };
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
    // The confirmation link opens the app and signs them in.
    options: { data: { full_name: fullName }, emailRedirectTo: Linking.createURL('/') },
  });
  if (error) throw error;
  return data.session && data.user ? fetchProfile(data.user.id) : null;
}

/** Where invite and password reset emails send people: the set-password screen. */
export const setPasswordUrl = () => Linking.createURL('/set-password');

/** Signs in with the session from an invite or reset link. */
export async function signInWithLinkSession(session: LinkSession): Promise<Profile> {
  if (!supabase) throw new Error('Supabase is not configured. Use a demo role instead.');
  const { data, error } = await supabase.auth.setSession({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
  });
  if (error) throw error;
  if (!data.user) throw new Error('That link has expired. Ask for a new one.');
  return fetchProfile(data.user.id);
}

/**
 * Signs in with the code from an invite, password reset or confirmation email,
 * for when the link can't open the app (say the email was read on a computer).
 * The code doesn't say which email it came from, so each kind is tried in turn.
 */
export async function verifyEmailCode(
  email: string,
  code: string,
  kinds: LinkSession['type'][],
): Promise<{ type: LinkSession['type']; userId: string }> {
  if (!supabase) throw new Error('Supabase is not configured. Use a demo role instead.');
  let lastError: Error = new Error('That code is wrong or has expired.');
  for (const type of kinds) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type });
    if (!error && data.user) return { type, userId: data.user.id };
    if (error) lastError = error;
  }
  throw lastError;
}

/** Sets the signed-in user's password, and their name if they haven't given one yet. */
export async function setPassword(password: string, fullName?: string): Promise<Profile> {
  if (!supabase) throw new Error('Supabase is not configured. Use a demo role instead.');
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  if (fullName) {
    const { error: nameError } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', data.user.id);
    if (nameError) throw nameError;
  }
  return fetchProfile(data.user.id);
}

/** Emails a link that opens the app to choose a new password. */
export async function sendPasswordReset(email: string) {
  if (!supabase) throw new Error('Supabase is not configured. Use a demo role instead.');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: setPasswordUrl(),
  });
  if (error) throw error;
}

/** Demo sign-in for mock mode: pick a role and get the seeded user who has it first. */
export async function signInAsDemo(role: Role | 'admin'): Promise<Profile> {
  const profile = mockProfiles.find((p) =>
    role === 'admin' ? p.isPlatformAdmin : p.gyms[0]?.role === role,
  );
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

/** The email the person signs in with, for showing on their profile. */
export async function fetchAccountEmail(): Promise<string | null> {
  if (!supabase) return delay('demo@corefit.app');
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}

export async function restoreProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ? fetchProfile(data.session.user.id) : null;
}
