import { useAuthStore } from '@/features/auth/auth-store';

/** The signed-in profile. Only call from screens behind the auth guard. */
export function useProfile() {
  const profile = useAuthStore((s) => s.profile);
  if (!profile) throw new Error('useProfile called while signed out');
  return profile;
}
