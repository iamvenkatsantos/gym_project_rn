import { confirm } from '@/components/confirm-dialog';
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

/** Sign out after the app's confirm dialog, so a stray tap doesn't sign anyone out. */
export function useConfirmSignOut() {
  const signOut = useSignOut();
  return async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You’ll need your password to sign in again.',
      confirmLabel: 'Sign out',
      icon: 'log-out-outline',
      tone: 'danger',
    });
    if (ok) await signOut();
  };
}
