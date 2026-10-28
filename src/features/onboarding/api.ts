import { delay, mockProfiles } from '@/lib/mock-db';
import { supabase } from '@/lib/supabase';

type Details = { fullName: string; phone: string; weightKg: number; heightCm: number };

/**
 * Saves a new member's details. The server checks a front, side and back photo
 * are already uploaded, then saves their name, phone and first measurement and
 * marks them as onboarded at this gym.
 */
export async function completeOnboarding(gymId: string, memberId: string, details: Details) {
  if (!supabase) {
    const profile = mockProfiles.find((p) => p.id === memberId);
    const gym = profile?.gyms.find((g) => g.gymId === gymId);
    if (profile) {
      profile.fullName = details.fullName;
      profile.phone = details.phone;
    }
    if (gym) gym.needsOnboarding = false;
    return delay(undefined);
  }
  const { error } = await supabase.rpc('complete_member_onboarding', {
    p_gym_id: gymId,
    p_full_name: details.fullName,
    p_phone: details.phone,
    p_weight_kg: details.weightKg,
    p_height_cm: details.heightCm,
  });
  if (error) throw error;
}
