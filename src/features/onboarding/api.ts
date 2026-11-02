import { delay, mockProfiles } from '@/lib/mock-db';
import { supabase } from '@/lib/supabase';

type Details = {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  weightKg: number;
  heightCm: number;
};

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
      profile.dateOfBirth = details.dateOfBirth;
    }
    if (gym) gym.needsOnboarding = false;
    return delay(undefined);
  }
  const args = {
    p_gym_id: gymId,
    p_full_name: details.fullName,
    p_phone: details.phone,
    p_weight_kg: details.weightKg,
    p_height_cm: details.heightCm,
  };
  let { error } = await supabase.rpc('complete_member_onboarding', {
    ...args,
    p_date_of_birth: details.dateOfBirth,
  });
  // Before the birthdays migration the form goes in without the date of birth.
  if (error?.code === 'PGRST202')
    ({ error } = await supabase.rpc('complete_member_onboarding', args));
  if (error) throw error;
}
