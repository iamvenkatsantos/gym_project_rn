import { signOut } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { queryClient } from '@/lib/query-client';

export function useSignOut() {
  const setProfile = useAuthStore((s) => s.setProfile);

  return async () => {
    await signOut();
    queryClient.clear();
    setProfile(null);
  };
}
