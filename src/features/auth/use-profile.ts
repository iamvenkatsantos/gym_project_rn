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
