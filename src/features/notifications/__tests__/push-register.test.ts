/* eslint-disable @typescript-eslint/no-require-imports -- modules are loaded per test, after their mocks */
// Android emits the push token event on every token fetch. If registering on that event fetched
// and saved again, the phone would call the API in a loop for as long as the app is open.
describe('registerForPush on Android', () => {
  it('saves the token once and ignores the event its own fetch sends', async () => {
    const savePushToken = jest.fn().mockResolvedValue(undefined);
    let push: typeof import('@/features/notifications/push');
    jest.isolateModules(() => {
      require('react-native').Platform.OS = 'android';
      jest.doMock('expo', () => ({ isRunningInExpoGo: () => false }));
      jest.doMock('expo-device', () => ({ isDevice: true }));
      jest.doMock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'p' } } } }));
      jest.doMock('@/lib/supabase', () => ({ supabase: {} }));
      jest.doMock('@/features/notifications/api', () => ({ savePushToken, removePushToken: jest.fn() }));
      jest.doMock('expo-notifications', () => ({
        AndroidImportance: { HIGH: 4 },
        setNotificationHandler: jest.fn(),
        setNotificationChannelAsync: jest.fn(),
        getPermissionsAsync: async () => ({ status: 'granted', canAskAgain: true }),
        getDevicePushTokenAsync: async () => ({ type: 'android', data: 'fcm-1' }),
        getExpoPushTokenAsync: async () => ({ type: 'expo', data: 'ExponentPushToken[1]' }),
      }));
      push = require('@/features/notifications/push');
    });

    expect(push!.isNewDeviceToken('fcm-1')).toBe(true);
    await push!.registerForPush({ ask: false });
    await push!.registerForPush({ ask: false });

    expect(savePushToken).toHaveBeenCalledTimes(1);
    expect(push!.isNewDeviceToken('fcm-1')).toBe(false);
    expect(push!.isNewDeviceToken('fcm-2')).toBe(true);
    require('react-native').Platform.OS = 'ios';
  });
});
