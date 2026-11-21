import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import type { ThemeColorId } from '@/constants/theme';
import { LOGO_BUCKET } from '@/features/gyms/logo';
import type { PickedPhoto } from '@/features/onboarding/types';
import type { GymDetails } from '@/features/gyms/types';
import { delay, MOCK_GYM_ID, mockId } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type GymRow = { name: string; address: string; city: string; phone: string; email: string };

const mockGyms: Record<string, GymDetails> = {
  [MOCK_GYM_ID]: {
    name: 'CoreFit Anna Nagar',
    address: '2nd Avenue, Anna Nagar',
    city: 'Chennai',
    phone: '9840012345',
    email: 'hello@corefit.example',
  },
};

/** Only people an admin invited to run a gym can set one up; the admin never does. */
export async function canSetUpGym(): Promise<boolean> {
  if (!supabase) return delay(true);
  return unwrap(await supabase.rpc('can_set_up_gym')) as boolean;
}

/** Creates a gym with the signed-in user as its only owner. Returns the new gym's id. */
export async function createGym(details: GymDetails): Promise<string> {
  if (!supabase) {
    const id = mockId('gym');
    mockGyms[id] = details;
    return delay(id);
  }
  return unwrap(
    await supabase.rpc('create_gym', {
      p_name: details.name,
      p_address: details.address,
      p_city: details.city,
      p_phone: details.phone,
      p_email: details.email,
    }),
  ) as string;
}

export async function fetchGymDetails(gymId: string): Promise<GymDetails> {
  if (!supabase) {
    return delay(
      mockGyms[gymId] ?? { name: 'Your gym', address: '', city: '', phone: '', email: '' },
    );
  }
  return unwrap(
    await supabase
      .from('gyms')
      .select('name, address, city, phone, email')
      .eq('id', gymId)
      .single(),
  ) as GymRow;
}

/** Owners only; RLS refuses everyone else. */
export async function updateGymDetails(gymId: string, details: GymDetails) {
  if (!supabase) {
    mockGyms[gymId] = details;
    return delay(undefined);
  }
  const { error } = await supabase.from('gyms').update(details).eq('id', gymId);
  if (error) throw error;
}

/** Owners only: the colour the branch's members, trainers, supervisors and dashboard use. */
export async function setGymThemeColor(gymId: string, color: ThemeColorId) {
  if (!supabase) return delay(undefined);
  const { error } = await supabase.rpc('set_gym_theme_color', { p_gym_id: gymId, p_color: color });
  if (error) throw error;
}

function logoExtension(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  return 'jpg';
}

/**
 * Platform admins only: uploads the picked image to <gym>/<random>.<ext> in the gym-logos bucket and saves
 * it as the branch's logo (a null photo removes it). A new name each time means a changed logo
 * never shows an old cached one. Returns the saved path.
 */
export async function saveGymLogo(
  gymId: string,
  photo: PickedPhoto | null,
  oldPath: string | null | undefined,
): Promise<string | null> {
  if (!supabase) return delay(photo ? photo.uri : null);
  let path: string | null = null;
  if (photo) {
    path = `${gymId}/${randomUUID()}.${logoExtension(photo.mimeType)}`;
    const bytes = await new File(photo.uri).arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(path, bytes, { contentType: photo.mimeType, upsert: false });
    if (uploadError) throw uploadError;
  }
  const { error } = await supabase.rpc('set_gym_logo', { p_gym_id: gymId, p_path: path });
  if (error) throw error;
  // Best effort: a leftover file is harmless.
  if (oldPath) await supabase.storage.from(LOGO_BUCKET).remove([oldPath]);
  return path;
}

/** Platform admins only: the branch's current logo path (admins aren't members of the branch). */
export async function fetchAdminGymLogo(gymId: string): Promise<string | null> {
  if (!supabase) return delay(null);
  const { data, error } = await supabase.rpc('admin_gym_logo', { p_gym_id: gymId });
  if (error) throw error;
  return (data as string | null) ?? null;
}
