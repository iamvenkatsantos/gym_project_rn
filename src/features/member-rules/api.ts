import { DEFAULT_MEMBER_RULES, type MemberRules } from '@/features/member-rules/types';
import { delay, forGym, mockMemberRules } from '@/lib/mock-db';
import { supabase } from '@/lib/supabase';

export async function fetchMemberRules(gymId: string): Promise<MemberRules> {
  if (!supabase) return delay(forGym(gymId, [mockMemberRules.value])[0] ?? DEFAULT_MEMBER_RULES);
  const { data, error } = await supabase
    .from('gyms')
    .select('pause_max_days, referral_reward_days, class_booking_cap')
    .eq('id', gymId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_MEMBER_RULES;
  return {
    pauseMaxDays: data.pause_max_days ?? 0,
    referralRewardDays: data.referral_reward_days ?? 0,
    classBookingCap: data.class_booking_cap ?? null,
  };
}

/** Owners only; the server checks. */
export async function saveMemberRules(gymId: string, rules: MemberRules) {
  if (!supabase) {
    mockMemberRules.value = rules;
    return delay(undefined);
  }
  const { error } = await supabase.rpc('set_member_rules', {
    p_gym_id: gymId,
    p_pause_max_days: rules.pauseMaxDays,
    p_referral_reward_days: rules.referralRewardDays,
    p_class_booking_cap: rules.classBookingCap,
  });
  if (error) throw error;
}
