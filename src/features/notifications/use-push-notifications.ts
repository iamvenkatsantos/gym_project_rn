import { router } from 'expo-router';
import { useEffect } from 'react';

import { selectActiveGym, useAuthStore } from '@/features/auth/auth-store';
import { notificationKeys } from '@/features/notifications/hooks';
import {
  isNewDeviceToken,
  Notifications,
  pushUnavailableReason,
  registerForPush,
} from '@/features/notifications/push';
import { gymForPush, parsePushData, pushRoute } from '@/features/notifications/rules';
import { queryClient } from '@/lib/query-client';

// Without expo-notifications (Expo Go on Android) nothing is ever tapped.
const useLastNotificationResponse = Notifications?.useLastNotificationResponse ?? (() => null);

/**
 * Registers the signed-in person's phone for pushes, refreshes the inbox when one arrives while
 * the app is open, and opens the inbox (switching to the push's gym) when one is tapped.
 * Announcements and managers' birthday pushes open their own screens (pushRoute).
 */
export function usePushNotifications() {
  const userId = useAuthStore((s) =>
    s.status === 'signedIn' && !s.needsPassword ? s.profile?.id : undefined,
  );
  const hasRole = useAuthStore((s) => !s.needsPassword && !!selectActiveGym(s));
  const lastResponse = useLastNotificationResponse();

  useEffect(() => {
    if (!userId || !Notifications || pushUnavailableReason()) return;
    registerForPush({ ask: true }).catch((e) => console.warn('Push registration failed', e));
    // The OS can rotate the device token; the Expo token follows it. Android also sends this
    // event on every token fetch, including registerForPush's own, so skip a token we already have.
    const tokens = Notifications.addPushTokenListener((deviceToken) => {
      if (!isNewDeviceToken(String(deviceToken.data))) return;
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
    if (!lastResponse || !hasRole || !Notifications) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    Notifications.clearLastNotificationResponse();
    const push = parsePushData(lastResponse.notification.request.content.data);
    const { profile, setActiveGym } = useAuthStore.getState();
    const gymId = push && profile ? gymForPush(push, profile.gyms) : null;
    if (!gymId || !push || !profile) return;
    setActiveGym(gymId);
    queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    router.push(pushRoute(push, profile.gyms));
  }, [lastResponse, hasRole]);
}
