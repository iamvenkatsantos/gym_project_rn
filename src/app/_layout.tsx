import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { Colors } from '@/constants/theme';

import { selectActiveGym, useAuthStore } from '@/features/auth/auth-store';
import { canManageGym } from '@/features/auth/types';
import { useAuthBootstrap } from '@/features/auth/use-auth-bootstrap';
import { useAuthLinks } from '@/features/auth/use-auth-links';
import { usePushNotifications } from '@/features/notifications/use-push-notifications';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
  },
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <KeyboardProvider>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style="light" />
          <RootNavigator />
        </ThemeProvider>
      </KeyboardProvider>
    </QueryClientProvider>
  );
}

/**
 * Each role only gets its own stack of screens; everything else is unreachable.
 * The role comes from the active gym, so switching gyms can switch areas.
 */
function RootNavigator() {
  useAuthBootstrap();
  useAuthLinks();
  usePushNotifications();
  const status = useAuthStore((s) => s.status);
  const settingPassword = useAuthStore((s) => s.status === 'signedIn' && s.needsPassword);
  // Nobody reaches their role's screens until they've chosen a password.
  const role = useAuthStore((s) => (settingPassword ? undefined : selectActiveGym(s)?.role));

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="enter-code" options={{ headerShown: true, title: 'Enter your code' }} />
      </Stack.Protected>
      <Stack.Protected guard={settingPassword}>
        <Stack.Screen name="set-password" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn' && !settingPassword && !role}>
        <Stack.Screen name="no-gym" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'member'}>
        <Stack.Screen name="member" />
        <Stack.Screen
          name="book-trainer/[trainerId]"
          options={{ headerShown: true, title: 'Book a session' }}
        />
        <Stack.Screen
          name="request-trainer"
          options={{ presentation: 'modal', headerShown: true, title: 'Ask for a trainer' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={role === 'trainer'}>
        <Stack.Screen name="trainer" />
        <Stack.Screen name="plan-editor" options={{ headerShown: true, title: 'Plan' }} />
        <Stack.Screen
          name="assign-plan/[workoutId]"
          options={{ headerShown: true, title: 'Assign' }}
        />
        <Stack.Screen name="weekly-hours" options={{ headerShown: true, title: 'Weekly hours' }} />
      </Stack.Protected>
      <Stack.Protected guard={role === 'owner'}>
        <Stack.Screen name="owner" />
        <Stack.Screen
          name="membership-plan-editor"
          options={{ headerShown: true, title: 'Membership plan' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={role === 'supervisor'}>
        <Stack.Screen name="supervisor" />
      </Stack.Protected>
      <Stack.Protected guard={!!role && canManageGym(role)}>
        <Stack.Screen
          name="invite-person"
          options={{ presentation: 'modal', headerShown: true, title: 'Invite someone' }}
        />
        <Stack.Screen name="person/[userId]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen
          name="record-membership"
          options={{ presentation: 'modal', headerShown: true, title: 'Record a payment' }}
        />
        <Stack.Screen
          name="trainer-request/[requestId]"
          options={{ headerShown: true, title: 'Trainer request' }}
        />
        <Stack.Screen
          name="message-trainer"
          options={{ presentation: 'modal', headerShown: true, title: 'Message a trainer' }}
        />
      </Stack.Protected>
      {/* Trainers follow their members; owners and supervisors follow everyone they oversee. */}
      <Stack.Protected guard={role === 'trainer' || (!!role && canManageGym(role))}>
        <Stack.Screen name="member-progress/[memberId]" options={{ headerShown: true }} />
      </Stack.Protected>
      {/* Owners schedule any class; trainers schedule and edit their own. */}
      <Stack.Protected guard={role === 'owner' || role === 'trainer'}>
        <Stack.Screen name="class-editor" options={{ headerShown: true, title: 'Class' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!role}>
        {/* Everyone trains, whatever their role. */}
        <Stack.Screen
          name="workout-session"
          options={{ headerShown: true, gestureEnabled: false }}
        />
        <Stack.Screen name="exercise/[exerciseId]" options={{ headerShown: true }} />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Inbox' }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen
          name="account"
          options={{ presentation: 'modal', headerShown: true, title: 'Account' }}
        />
      </Stack.Protected>
    </Stack>
  );
}
