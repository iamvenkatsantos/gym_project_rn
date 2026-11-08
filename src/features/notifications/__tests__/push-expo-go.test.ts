/* eslint-disable @typescript-eslint/no-require-imports -- modules are loaded per test, after their mocks */
// Expo Go on Android has no native push module, so loading expo-notifications there crashes
// the app on start. push.ts must not load it.
describe('push in Expo Go on Android', () => {
  it('never loads expo-notifications and explains why push is off', () => {
    jest.isolateModules(() => {
      const Platform = require('react-native').Platform;
      Platform.OS = 'android';
      jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));
      jest.doMock('expo-device', () => ({ isDevice: true }));
      // The session store loads native crypto through the 'expo' module mocked above.
      jest.doMock('@/lib/secure-session-storage', () => ({
        secureSessionStorage: require('@react-native-async-storage/async-storage').default,
      }));
      jest.doMock('expo-notifications', () => {
        throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
      });
      const push = require('@/features/notifications/push');
      expect(push.Notifications).toBeNull();
      expect(push.pushUnavailableReason()).toMatch(/Expo Go on Android/);
      expect(() => push.clearBadge()).not.toThrow();
      Platform.OS = 'ios';
    });
  });
});
