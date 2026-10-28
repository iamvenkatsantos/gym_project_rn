import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { removePushToken, savePushToken } from '@/features/notifications/api';
import { supabase } from '@/lib/supabase';

type NotificationsModule = typeof import('expo-notifications');

/**
 * expo-notifications, or null where loading it crashes the app: Expo Go on Android (push was
 * removed from it in SDK 53) and the web. Everything else in the app goes through this.
 */
export const Notifications: NotificationsModule | null =
  Platform.OS === 'web' || (Platform.OS === 'android' && isRunningInExpoGo())
    ? null
    : // Loaded lazily so the module isn't evaluated where its native side is missing.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('expo-notifications');

// Pushes that arrive while the app is open still show as a banner.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** The token saved for whoever is signed in on this phone, so sign-out can remove it. */
let savedToken: string | null = null;

/**
 * The device token behind savedToken. Android emits the push token event on every token fetch,
 * not only when the OS rotates it, so listeners compare against this to avoid a fetch loop.
 */
let lastDeviceToken: string | null = null;

/** Whether a push token event carries a device token this run hasn't registered yet. */
export function isNewDeviceToken(deviceToken: string): boolean {
  return deviceToken !== lastDeviceToken;
}

/**
 * Why this run can't get a push token, or null if it can. Push needs a real phone, the real
 * backend, an EAS project id, and on Android a development or store build (not Expo Go).
 */
export function pushUnavailableReason(): string | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'Push only works on phones.';
  if (!Notifications) return 'Expo Go on Android has no push. Use a development build.';
  if (!Device.isDevice) return 'Push needs a real phone, not a simulator.';
  if (!supabase) return 'The demo has no backend to send pushes.';
  if (!projectId()) return 'Run `eas init` so the app has an EAS project id.';
  return null;
}

function projectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Asks for permission (once; later calls only check) and saves this phone's Expo push token
 * for the signed-in person. Returns whether pushes are on.
 */
export async function registerForPush({ ask }: { ask: boolean }): Promise<boolean> {
  if (!Notifications || pushUnavailableReason()) return false;

  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Gym updates',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#3DDC5C',
    });
  }

  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask && canAskAgain) {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return false;

  const devicePushToken = await Notifications.getDevicePushTokenAsync();
  lastDeviceToken = String(devicePushToken.data);
  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: projectId(),
    devicePushToken,
  });
  // Already saved for this person: every app start and token event would otherwise call the API.
  if (token !== savedToken) {
    await savePushToken(token, Platform.OS as 'ios' | 'android');
    savedToken = token;
  }
  return true;
}

/** Stops pushes to this phone for the person signing out. Never blocks sign-out. */
export async function unregisterForPush() {
  const token = savedToken;
  savedToken = null;
  lastDeviceToken = null;
  if (!token) return;
  await removePushToken(token).catch(() => {});
  await Notifications?.setBadgeCountAsync(0).catch(() => {});
}

/** Clears the app icon badge, e.g. once the inbox has been read. */
export function clearBadge() {
  if (!Notifications || pushUnavailableReason()) return;
  Notifications.setBadgeCountAsync(0).catch(() => {});
}

/** Whether this phone allows notifications, and whether the app may still ask. */
export async function getPushPermission() {
  if (!Notifications) return { status: 'undetermined', canAskAgain: false };
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return { status, canAskAgain };
}
