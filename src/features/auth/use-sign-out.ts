import { signOut } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { unregisterForPush } from '@/features/notifications/push';
import { useWorkoutDraft } from '@/features/progress/draft-store';
import { queryClient } from '@/lib/query-client';

export function useSignOut() {
  const setProfile = useAuthStore((s) => s.setProfile);

  return async () => {
    // Removing the token needs the session, so it goes before signing out.
    await unregisterForPush();
    await signOut();
    queryClient.clear();
    // The next person to sign in on this phone mustn't inherit a workout in progress.
    useWorkoutDraft.getState().discard();
    useAuthStore.getState().setNeedsPassword(false);
    setProfile(null);
  };
}
