import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { Colors, type ColorScheme } from '@/constants/theme';

import { selectActiveGym, selectInAdmin, useAuthStore } from '@/features/auth/auth-store';
import { canCoach, canManageGym } from '@/features/auth/types';
import { useAuthBootstrap } from '@/features/auth/use-auth-bootstrap';
import { useAuthLinks } from '@/features/auth/use-auth-links';
import { usePushNotifications } from '@/features/notifications/use-push-notifications';
import { useColorSchemeName } from '@/hooks/use-theme';
import { queryClient } from '@/lib/query-client';

SplashScreen.preventAutoHideAsync();

function navigationTheme(scheme: ColorScheme): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };
}

export default function RootLayout() {
  const scheme = useColorSchemeName();

  // The window behind the app shows during transitions and the keyboard; keep it on theme.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(Colors[scheme].background).catch(() => {});
  }, [scheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <KeyboardProvider>
        <ThemeProvider value={navigationTheme(scheme)}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
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
  // Platform admins get their own area with no gym in it, until they switch to a gym.
  const inAdmin = useAuthStore((s) => !settingPassword && selectInAdmin(s));

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hideAsync();
  }, [status]);

  if (status === 'loading') return null;

  return (
    // Every screen has a title: iOS shows the previous screen's title on the back button, and
    // without one it falls back to the route name (e.g. "no-gym" or "member").
    <Stack
      screenOptions={{
        headerShown: false,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
      }}>
      <Stack.Screen name="index" options={{ title: 'CoreFit Gym' }} />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
        <Stack.Screen name="enter-code" options={{ headerShown: true, title: 'Enter your code' }} />
      </Stack.Protected>
      <Stack.Protected guard={settingPassword}>
        <Stack.Screen name="set-password" options={{ title: 'Choose a password' }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn' && !settingPassword && !role && !inAdmin}>
        <Stack.Screen name="no-gym" options={{ title: 'Welcome' }} />
      </Stack.Protected>
      {/* New owners set up their gym here; owners can add another one. The server checks who may. */}
      <Stack.Protected guard={status === 'signedIn' && !settingPassword}>
        <Stack.Screen name="set-up-gym" options={{ headerShown: true, title: 'Set up your gym' }} />
      </Stack.Protected>
      {/* CoreFit Gym's admin: owners, branches and billing. The server checks every call too. */}
      <Stack.Protected guard={inAdmin}>
        <Stack.Screen name="admin" options={{ title: 'Overview' }} />
        <Stack.Screen
          name="admin-owner/[ownerId]"
          options={{ headerShown: true, title: 'Owner' }}
        />
        <Stack.Screen
          name="admin-branch/[gymId]"
          options={{ headerShown: true, title: 'Branch' }}
        />
        <Stack.Screen
          name="admin-brand/[brandId]"
          options={{ headerShown: true, title: 'Brand' }}
        />
        <Stack.Screen name="add-branch" options={{ headerShown: true, title: 'Add a branch' }} />
      </Stack.Protected>
      <Stack.Protected guard={role === 'member'}>
        <Stack.Screen name="member" options={{ title: 'Home' }} />
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
        <Stack.Screen name="trainer" options={{ title: 'Home' }} />
      </Stack.Protected>
      <Stack.Protected guard={role === 'owner'}>
        <Stack.Screen name="owner" options={{ title: 'Dashboard' }} />
        <Stack.Screen
          name="membership-plan-editor"
          options={{ headerShown: true, title: 'Membership plan' }}
        />
        {/* Only owners take reports out of the app; the server enforces it too. */}
        <Stack.Screen name="reports" options={{ headerShown: true, title: 'Export reports' }} />
        <Stack.Screen name="insights" options={{ headerShown: true, title: 'Insights' }} />
        <Stack.Screen name="gym-details" options={{ headerShown: true, title: 'Gym details' }} />
        {/* Owners of more than one branch see them side by side. */}
        <Stack.Screen name="branches" options={{ headerShown: true, title: 'All branches' }} />
      </Stack.Protected>
      <Stack.Protected guard={role === 'supervisor'}>
        <Stack.Screen name="supervisor" options={{ title: 'Dashboard' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!role && canManageGym(role)}>
        <Stack.Screen
          name="invite-person"
          options={{ presentation: 'modal', headerShown: true, title: 'Invite someone' }}
        />
        <Stack.Screen name="person/[userId]" options={{ headerShown: true, title: 'Person' }} />
        <Stack.Screen name="attendance" options={{ headerShown: true, title: 'Attendance' }} />
        <Stack.Screen name="renewals" options={{ headerShown: true, title: 'Renewals due' }} />
        <Stack.Screen
          name="payment-history/[memberId]"
          options={{ headerShown: true, title: 'Payments' }}
        />
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
        {/* The front desk: walk-in enquiries, follow-ups and trial passes. */}
        <Stack.Screen name="enquiries" options={{ headerShown: true, title: 'Enquiries' }} />
        <Stack.Screen
          name="enquiry/[enquiryId]"
          options={{ headerShown: true, title: 'Enquiry' }}
        />
        <Stack.Screen
          name="enquiry-editor"
          options={{ presentation: 'modal', headerShown: true, title: 'New enquiry' }}
        />
        <Stack.Screen
          name="new-announcement"
          options={{ presentation: 'modal', headerShown: true, title: 'New announcement' }}
        />
        {/* The branch's check-in QR: a live code for the desk, the poster and (owners) the rules. */}
        <Stack.Screen name="check-in-qr" options={{ headerShown: true, title: 'Check-in QR' }} />
        <Stack.Screen
          name="check-in-display"
          options={{ headerShown: true, title: 'Live check-in QR' }}
        />
      </Stack.Protected>
      {/* Members and trainers check in and out by scanning the branch's QR. */}
      <Stack.Protected guard={role === 'member' || role === 'trainer'}>
        <Stack.Screen name="scan-check-in" options={{ headerShown: true, title: 'Scan QR' }} />
      </Stack.Protected>
      {/*
        Coaching tools. Owners and supervisors coach too, so a gym without trainers still runs.
        Trainers follow their members; owners and supervisors follow everyone they oversee.
        Owners schedule any class; trainers and supervisors schedule and edit their own.
      */}
      <Stack.Protected guard={!!role && canCoach(role)}>
        <Stack.Screen name="plan-editor" options={{ headerShown: true, title: 'Plan' }} />
        <Stack.Screen
          name="assign-plan/[workoutId]"
          options={{ headerShown: true, title: 'Assign' }}
        />
        <Stack.Screen name="meal-plan-editor" options={{ headerShown: true, title: 'Diet plan' }} />
        <Stack.Screen
          name="assign-meal-plan/[planId]"
          options={{ headerShown: true, title: 'Assign' }}
        />
        <Stack.Screen name="weekly-hours" options={{ headerShown: true, title: 'Weekly hours' }} />
        <Stack.Screen
          name="member-progress/[memberId]"
          options={{ headerShown: true, title: 'Progress' }}
        />
        <Stack.Screen name="class-editor" options={{ headerShown: true, title: 'Class' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!role}>
        {/* Everyone trains, whatever their role. */}
        <Stack.Screen
          name="workout-session"
          options={{ headerShown: true, gestureEnabled: false, title: 'Workout' }}
        />
        <Stack.Screen
          name="exercise/[exerciseId]"
          options={{ headerShown: true, title: 'Exercise' }}
        />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Inbox' }} />
        {/* Everyone can track their body; the database decides whose they may see. */}
        <Stack.Screen
          name="log-measurements"
          options={{ presentation: 'modal', headerShown: true, title: 'Log measurements' }}
        />
        <Stack.Screen
          name="add-progress-photo"
          options={{ presentation: 'modal', headerShown: true, title: 'Add a photo' }}
        />
        <Stack.Screen
          name="progress-photo/[photoId]"
          options={{ headerShown: true, title: 'Photo' }}
        />
        <Stack.Screen
          name="announcements"
          options={{ headerShown: true, title: 'Announcements' }}
        />
        <Stack.Screen
          name="payment/[paymentId]"
          options={{ headerShown: true, title: 'Payment' }}
        />
        <Stack.Screen name="payment-return" options={{ title: 'Payment' }} />
        <Stack.Screen
          name="payment-history/index"
          options={{ headerShown: true, title: 'Payment history' }}
        />
        {/* Where a branch QR's corefit://check-in link lands. The server says who may check in. */}
        <Stack.Screen name="check-in" options={{ headerShown: true, title: 'Check in' }} />
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
