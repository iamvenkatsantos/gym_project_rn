import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { selectActiveGym, useAuthStore } from '@/features/auth/auth-store';
import { notificationKeys } from '@/features/notifications/hooks';
import { pushUnavailableReason, registerForPush } from '@/features/notifications/push';
import { gymForPush, parsePushData } from '@/features/notifications/rules';
import { queryClient } from '@/lib/query-client';

/**
 * Registers the signed-in person's phone for pushes, refreshes the inbox when one arrives while
 * the app is open, and opens the inbox (switching to the push's gym) when one is tapped.
 */
export function usePushNotifications() {
  const userId = useAuthStore((s) =>
    s.status === 'signedIn' && !s.needsPassword ? s.profile?.id : undefined,
  );
  const hasRole = useAuthStore((s) => !s.needsPassword && !!selectActiveGym(s));
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!userId || pushUnavailableReason()) return;
    registerForPush({ ask: true }).catch((e) => console.warn('Push registration failed', e));
    // The OS can rotate the device token; the Expo token follows it.
    const tokens = Notifications.addPushTokenListener(() => {
      registerForPush({ ask: false }).catch(() => {});
    });
    const received = Notifications.addNotificationReceivedListener(() => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    });
    return () => {
      tokens.remove();
      received.remove();
    };
  }, [userId]);

  // A tap can arrive before sign-in is restored on a cold start, so wait for a role.
  useEffect(() => {
    if (!lastResponse || !hasRole) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    Notifications.clearLastNotificationResponse();
    const push = parsePushData(lastResponse.notification.request.content.data);
    const { profile, setActiveGym } = useAuthStore.getState();
    const gymId = push && profile ? gymForPush(push, profile.gyms) : null;
    if (!gymId) return;
    setActiveGym(gymId);
    queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    router.push('/notifications');
  }, [lastResponse, hasRole]);
}
