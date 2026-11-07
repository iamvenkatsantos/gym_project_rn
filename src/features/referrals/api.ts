import { normalizePhone } from '@/features/enquiries/rules';
import {
  STAFF_REFERRAL_DAYS,
  type Referral,
  type ReferralStatus,
  type StaffReferral,
} from '@/features/referrals/types';
import { delay, forGym, mockId, mockReferrals } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type ReferralRow = {
  id: string;
  full_name: string;
  status: ReferralStatus;
  reward_days: number | null;
  reward_applied: boolean;
  created_at: string;
};

export async function listMyReferrals(gymId: string, memberId: string): Promise<Referral[]> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockReferrals)
        .filter((r) => r.referrerId === memberId)
        .map(({ referrerId: _, referrerName: __, phone: ___, ...r }) => r),
    );
  }
  const rows = unwrap(
    await supabase.rpc('my_referrals', { p_gym_id: gymId }),
  ) as unknown as ReferralRow[];
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    status: r.status,
    rewardDays: r.reward_days,
    rewardApplied: r.reward_applied,
    createdAt: r.created_at,
  }));
}

/**
 * Referrals from the last two weeks at this branch. Owners and supervisors see all; trainers
 * only those from members they train (the server decides).
 */
export async function listGymReferrals(gymId: string): Promise<StaffReferral[]> {
  if (!supabase) {
    const since = new Date(Date.now() - STAFF_REFERRAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    return delay(
      forGym(gymId, mockReferrals)
        .filter((r) => r.createdAt > since)
        .map((r) => ({
          id: r.id,
          fullName: r.fullName,
          phone: r.phone,
          referredByName: r.referrerName,
          status: r.status,
          createdAt: r.createdAt,
        })),
    );
  }
  const rows = unwrap(
    await supabase.rpc('gym_referrals', { p_gym_id: gymId, p_days: STAFF_REFERRAL_DAYS }),
  ) as unknown as {
    id: string;
    full_name: string;
    phone: string;
    referred_by_name: string;
    status: ReferralStatus;
    created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    referredByName: r.referred_by_name,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/** Passes a friend to the front desk as an enquiry. The server checks the number. */
export async function referFriend(
  gymId: string,
  memberId: string,
  friend: { fullName: string; phone: string },
) {
  const phone = normalizePhone(friend.phone);
  if (!supabase) {
    if (mockReferrals.some((r) => r.fullName === friend.fullName.trim())) {
      throw new Error('The gym is already in touch with them');
    }
    mockReferrals.unshift({
      id: mockId('ref'),
      referrerId: memberId,
      fullName: friend.fullName.trim(),
      status: 'pending',
      rewardDays: null,
      rewardApplied: false,
      createdAt: new Date().toISOString(),
      referrerName: 'You',
      phone,
    });
    return delay(undefined);
  }
  const { error } = await supabase.rpc('refer_friend', {
    p_gym_id: gymId,
    p_full_name: friend.fullName,
    p_phone: phone,
  });
  if (error) throw error;
}
