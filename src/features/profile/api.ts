import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import type { PickedPhoto } from '@/features/onboarding/types';
import type { ProfileDetails } from '@/features/profile/types';
import { delay, mockProfiles } from '@/lib/mock-db';
import { supabase } from '@/lib/supabase';

const BUCKET = 'avatars';

/** The public link to a profile photo. In demo mode the path is the photo's local uri. */
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!supabase) return path;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function extensionFor(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  return 'jpg';
}

/**
 * Uploads a profile photo to <user>/<random id>.<ext> and returns its path. A
 * new name each time means a changed photo never shows an old cached one.
 */
export async function uploadAvatar(userId: string, photo: PickedPhoto): Promise<string> {
  if (!supabase) return delay(photo.uri);
  const path = `${userId}/${randomUUID()}.${extensionFor(photo.mimeType)}`;
  const bytes = await new File(photo.uri).arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: photo.mimeType, upsert: false });
  if (error) throw error;
  return path;
}

/** Removes photos nothing points at any more. Best effort: a leftover file is harmless. */
export async function removeAvatars(paths: string[]) {
  if (!supabase || paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}

/** Every photo in the signed-in person's folder, e.g. before deleting their account. */
export async function removeOwnAvatars() {
  if (!supabase) return;
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return;
  const { data } = await supabase.storage.from(BUCKET).list(userId);
  await removeAvatars((data ?? []).map((f) => `${userId}/${f.name}`));
}

/** Saves the signed-in person's name, mobile and photo (null removes it) in one go. */
export async function saveMyProfile(userId: string, details: ProfileDetails) {
  if (!supabase) {
    const profile = mockProfiles.find((p) => p.id === userId);
    if (profile) {
      profile.fullName = details.fullName;
      profile.phone = details.phone;
      profile.avatarPath = details.avatarPath;
      profile.avatarUrl = avatarUrl(details.avatarPath);
      if (details.dateOfBirth !== undefined) profile.dateOfBirth = details.dateOfBirth;
    }
    return delay(undefined);
  }
  const args = {
    p_full_name: details.fullName,
    p_phone: details.phone,
    p_avatar_path: details.avatarPath,
  };
  const { error } =
    details.dateOfBirth === undefined
      ? await supabase.rpc('save_my_profile', args)
      : await supabase.rpc('save_my_profile', { ...args, p_date_of_birth: details.dateOfBirth });
  if (error) throw error;
}

/** Sets just the photo, for a new member whose name and phone go in with their first-sign-in form. */
export async function setMyAvatar(userId: string, avatarPath: string) {
  if (!supabase) {
    const profile = mockProfiles.find((p) => p.id === userId);
    if (profile) {
      profile.avatarPath = avatarPath;
      profile.avatarUrl = avatarUrl(avatarPath);
    }
    return delay(undefined);
  }
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_path: avatarPath })
    .eq('id', userId);
  if (error) throw error;
}
