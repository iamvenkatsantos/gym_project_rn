import { useQuery } from '@tanstack/react-query';

import { fetchAccountEmail } from '@/features/auth/api';
import { selectActiveGym, useAuthStore } from '@/features/auth/auth-store';

/** The signed-in profile. Only call from screens behind the auth guard. */
export function useProfile() {
  const profile = useAuthStore((s) => s.profile);
  if (!profile) throw new Error('useProfile called while signed out');
  return profile;
}

/** The gym (and the user's role in it) the app is showing. Only call behind the role guards. */
export function useActiveGym() {
  const gym = useAuthStore(selectActiveGym);
  if (!gym) throw new Error('useActiveGym called without an active gym');
  return gym;
}

/** The signed-in email. It's in the stored session, so this doesn't wait on the network. */
export function useAccountEmail() {
  const userId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: ['account-email', userId],
    queryFn: fetchAccountEmail,
    enabled: !!userId,
    staleTime: Infinity,
  });
}
