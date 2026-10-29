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
