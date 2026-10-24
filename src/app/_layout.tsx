import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';

import { selectActiveGym, useAuthStore } from '@/features/auth/auth-store';
import { useAuthBootstrap } from '@/features/auth/use-auth-bootstrap';
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
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="light" />
        <RootNavigator />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * Each role only gets its own stack of screens; everything else is unreachable.
 * The role comes from the active gym, so switching gyms can switch areas.
 */
function RootNavigator() {
  useAuthBootstrap();
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => selectActiveGym(s)?.role);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn' && !role}>
        <Stack.Screen name="no-gym" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'member'}>
        <Stack.Screen name="member" />
        <Stack.Screen
          name="book-trainer/[trainerId]"
          options={{ headerShown: true, title: 'Book a session' }}
        />
        <Stack.Screen
          name="workout-session"
          options={{ headerShown: true, gestureEnabled: false }}
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
        <Stack.Screen name="member-progress/[memberId]" options={{ headerShown: true }} />
      </Stack.Protected>
      <Stack.Protected guard={role === 'owner'}>
        <Stack.Screen name="owner" />
        <Stack.Screen
          name="invite-person"
          options={{ presentation: 'modal', headerShown: true, title: 'Invite someone' }}
        />
        <Stack.Screen name="person/[userId]" options={{ headerShown: true, title: '' }} />
        <Stack.Screen name="class-editor" options={{ headerShown: true, title: 'Class' }} />
        <Stack.Screen
          name="membership-plan-editor"
          options={{ headerShown: true, title: 'Membership plan' }}
        />
        <Stack.Screen
          name="record-membership"
          options={{ presentation: 'modal', headerShown: true, title: 'Record a payment' }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!!role}>
        <Stack.Screen name="exercise/[exerciseId]" options={{ headerShown: true }} />
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
