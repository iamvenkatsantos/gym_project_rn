import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { type ColorScheme, type Palette } from '@/constants/theme';

import {
  selectActiveGym,
  selectInAdmin,
  selectNeedsProfile,
  useAuthStore,
} from '@/features/auth/auth-store';
import { canCoach, canManageGym } from '@/features/auth/types';
import { useAuthBootstrap } from '@/features/auth/use-auth-bootstrap';
import { useAuthLinks } from '@/features/auth/use-auth-links';
import { usePushNotifications } from '@/features/notifications/use-push-notifications';
import { perfMark } from '@/lib/perf-log';
import { useRememberGymBranding } from '@/features/gyms/use-remember-branding';
import { AnimatedSplash } from '@/features/splash/components/animated-splash';
import { useActiveBranchLocked } from '@/features/subscription/hooks';
import { useOtaUpdates } from '@/features/updates/use-ota-updates';
import { useColorSchemeName, useTheme } from '@/hooks/use-theme';
import { queryClient } from '@/lib/query-client';
import { useT } from '@/i18n';

SplashScreen.preventAutoHideAsync();
// The intro's first frame is an exact copy of the native splash, so swap instantly: the default
// 400 ms fade showed both logos at once and held the intro back.
SplashScreen.setOptions({ fade: false, duration: 0 });

function navigationTheme(scheme: ColorScheme, colors: Palette): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
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
  const colors = useTheme();
  const navTheme = useMemo(() => navigationTheme(scheme, colors), [scheme, colors]);
  const authLoaded = useAuthStore((s) => s.status !== 'loading');
  useRememberGymBranding();

  useEffect(() => {
    if (authLoaded) perfMark('Sign-in loaded');
  }, [authLoaded]);

  // The window behind the app shows during transitions and the keyboard; keep it on theme.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <QueryClientProvider client={queryClient}>
      <KeyboardProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <RootNavigator />
          {/* Takes over from the native splash and fades away once sign-in has loaded. */}
          <AnimatedSplash ready={authLoaded} />
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
  const t = useT();
  useAuthBootstrap();
  useAuthLinks();
  usePushNotifications();
  useOtaUpdates();
  const status = useAuthStore((s) => s.status);
  const settingPassword = useAuthStore((s) => s.status === 'signedIn' && s.needsPassword);
  // New members fill in their details and photos before anything else.
  const onboarding = useAuthStore((s) => !settingPassword && !!selectActiveGym(s)?.needsOnboarding);
  // Everyone else without a mobile number (mostly staff) fills in their profile first.
  const profileSetup = useAuthStore((s) => !settingPassword && selectNeedsProfile(s));
  // Nobody reaches their role's screens until they've chosen a password and filled
  // in their details.
  const gymRole = useAuthStore((s) =>
    settingPassword || onboarding || profileSetup ? undefined : selectActiveGym(s)?.role,
  );
  // A branch whose CoreFit plan lapsed more than 5 days ago gets only the locked screen.
  const branchLocked = useActiveBranchLocked();
  const locked = !!gymRole && branchLocked;
  const role = locked ? undefined : gymRole;
  // Platform admins get their own area with no gym in it, until they switch to a gym.
  const inAdmin = useAuthStore((s) => !settingPassword && selectInAdmin(s));

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
      <Stack.Screen name="index" options={{ title: t('CoreFit') }} />
      <Stack.Protected guard={status === 'signedOut'}>
        <Stack.Screen name="sign-in" options={{ title: t('Sign in') }} />
        <Stack.Screen
          name="enter-code"
          options={{ headerShown: true, title: t('Enter your code') }}
        />
        <Stack.Screen name="join" options={{ headerShown: true, title: t('Join your gym') }} />
        <Stack.Screen
          name="reset-password"
          options={{ headerShown: true, title: t('Reset password') }}
        />
      </Stack.Protected>
      <Stack.Protected guard={settingPassword}>
        <Stack.Screen name="set-password" options={{ title: t('Choose a password') }} />
      </Stack.Protected>
      <Stack.Protected
        guard={
          status === 'signedIn' &&
          !settingPassword &&
          !onboarding &&
          !profileSetup &&
          !role &&
          !locked &&
          !inAdmin
        }>
        <Stack.Screen name="no-gym" options={{ title: t('Welcome') }} />
      </Stack.Protected>
      <Stack.Protected guard={locked && !inAdmin}>
        <Stack.Screen
          name="plan-locked"
          options={{ headerShown: true, headerBackVisible: false, title: t('CoreFit plan') }}
        />
      </Stack.Protected>
      <Stack.Protected guard={onboarding}>
        {/* A native header keeps the title clear of the status bar; there's nowhere to go back to. */}
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: true, headerBackVisible: false, title: t('Welcome') }}
        />
      </Stack.Protected>
      <Stack.Protected guard={profileSetup}>
        <Stack.Screen
          name="profile-setup"
          options={{ headerShown: true, headerBackVisible: false, title: t('Your profile') }}
        />
      </Stack.Protected>
      {/* New owners set up their gym here; owners can add another one. The server checks who may.
          Anyone signed in changes their photo, name and mobile on Edit profile. */}
      <Stack.Protected guard={status === 'signedIn' && !settingPassword}>
        <Stack.Screen
          name="edit-profile"
          options={{ headerShown: true, title: t('Edit profile') }}
        />
        <Stack.Screen
          name="set-up-gym"
          options={{ headerShown: true, title: t('Set up your gym') }}
        />
      </Stack.Protected>
      {/* CoreFit's admin: owners, branches and billing. The server checks every call too. */}
      <Stack.Protected guard={inAdmin}>
        <Stack.Screen name="admin" options={{ title: t('Overview') }} />
        <Stack.Screen
          name="admin-owner/[ownerId]"
          options={{ headerShown: true, title: t('Owner') }}
        />
        <Stack.Screen
          name="admin-branch/[gymId]"
          options={{ headerShown: true, title: t('Branch') }}
        />
        <Stack.Screen
          name="admin-brand/[brandId]"
          options={{ headerShown: true, title: t('Brand') }}
        />
        <Stack.Screen name="add-branch" options={{ headerShown: true, title: t('Add a branch') }} />
        <Stack.Screen
          name="invite-owner"
          options={{ headerShown: true, title: t('Invite a gym owner') }}
        />
      </Stack.Protected>
      <Stack.Protected guard={role === 'member'}>
        <Stack.Screen name="member" options={{ title: t('Home') }} />
        <Stack.Screen
          name="book-trainer/[trainerId]"
          options={{ headerShown: true, title: t('Book a session') }}
        />
        <Stack.Screen
          name="request-trainer"
          options={{ presentation: 'modal', headerShown: true, title: t('Ask for a trainer') }}
        />
        <Stack.Screen
          name="refer-friend"
          options={{ headerShown: true, title: t('Refer a friend') }}
        />
      </Stack.Protected>
      {/* Members pause their own membership; owners and supervisors anyone's. */}
      <Stack.Protected guard={role === 'member' || (!!role && canManageGym(role))}>
        <Stack.Screen
          name="pause-membership"
          options={{ presentation: 'modal', headerShown: true, title: t('Pause membership') }}
        />
      </Stack.Protected>
      <Stack.Protected guard={role === 'trainer'}>
        <Stack.Screen name="trainer" options={{ title: t('Home') }} />
        <Stack.Screen name="permissions" options={{ headerShown: true, title: t('Permission') }} />
      </Stack.Protected>
      <Stack.Protected guard={role === 'owner'}>
        <Stack.Screen name="owner" options={{ title: t('Dashboard') }} />
        <Stack.Screen
          name="membership-plan-editor"
          options={{ headerShown: true, title: t('Membership plan') }}
        />
        <Stack.Screen
          name="loyalty-offer"
          options={{ headerShown: true, title: t('Loyalty offer') }}
        />
        <Stack.Screen
          name="member-rules"
          options={{ headerShown: true, title: t('Member rules') }}
        />
        {/* Only owners take reports out of the app; the server enforces it too. */}
        <Stack.Screen name="reports" options={{ headerShown: true, title: t('Export reports') }} />
        <Stack.Screen name="insights" options={{ headerShown: true, title: t('Insights') }} />
        <Stack.Screen
          name="trainer-hours"
          options={{ headerShown: true, title: t('Trainer hours') }}
        />
        <Stack.Screen name="gym-details" options={{ headerShown: true, title: t('Gym details') }} />
        <Stack.Screen
          name="import-members"
          options={{ headerShown: true, title: t('Import members') }}
        />
        {/* Owners of more than one branch see them side by side. */}
        <Stack.Screen name="branches" options={{ headerShown: true, title: t('All branches') }} />
        {/* What the branch pays CoreFit each year, paid in the app. */}
        <Stack.Screen
          name="subscription"
          options={{ headerShown: true, title: t('CoreFit plan') }}
        />
      </Stack.Protected>
      <Stack.Protected guard={role === 'supervisor'}>
        <Stack.Screen name="supervisor" options={{ title: t('Dashboard') }} />
      </Stack.Protected>
      <Stack.Protected guard={!!role && canManageGym(role)}>
        <Stack.Screen name="person/[userId]" options={{ headerShown: true, title: t('Person') }} />
        <Stack.Screen name="attendance" options={{ headerShown: true, title: t('Attendance') }} />
        <Stack.Screen name="renewals" options={{ headerShown: true, title: t('Renewals due') }} />
        <Stack.Screen name="birthdays" options={{ headerShown: true, title: t('Birthdays') }} />
        <Stack.Screen
          name="payment-history/[memberId]"
          options={{ headerShown: true, title: t('Payments') }}
        />
        <Stack.Screen
          name="record-membership"
          options={{ presentation: 'modal', headerShown: true, title: t('Record a payment') }}
        />
        {/* Matching members with trainers, from either side. */}
        <Stack.Screen
          name="match-trainers"
          options={{ headerShown: true, title: t('Match trainers') }}
        />
        <Stack.Screen
          name="member-trainers/[memberId]"
          options={{ headerShown: true, title: t('Trainers') }}
        />
        <Stack.Screen
          name="trainer-members/[trainerId]"
          options={{ headerShown: true, title: t('Members') }}
        />
        <Stack.Screen
          name="trainer-request/[requestId]"
          options={{ headerShown: true, title: t('Trainer request') }}
        />
        <Stack.Screen
          name="message-trainer"
          options={{ presentation: 'modal', headerShown: true, title: t('Message a trainer') }}
        />
        {/* The front desk: walk-in enquiries, follow-ups and trial passes. */}
        <Stack.Screen name="enquiries" options={{ headerShown: true, title: t('Enquiries') }} />
        <Stack.Screen
          name="enquiry/[enquiryId]"
          options={{ headerShown: true, title: t('Enquiry') }}
        />
        <Stack.Screen
          name="enquiry-editor"
          options={{ presentation: 'modal', headerShown: true, title: t('New enquiry') }}
        />
        <Stack.Screen
          name="new-announcement"
          options={{ presentation: 'modal', headerShown: true, title: t('New announcement') }}
        />
        {/* The branch's check-in QR: a live code for the desk, the poster and (owners) the rules. */}
        <Stack.Screen
          name="check-in-qr"
          options={{ headerShown: true, title: t('Check-in settings') }}
        />
        <Stack.Screen
          name="check-in-display"
          options={{ headerShown: true, title: t('Live check-in QR') }}
        />
      </Stack.Protected>
      {/* Members and trainers check in and out by scanning the branch's QR. */}
      <Stack.Protected guard={role === 'member' || role === 'trainer'}>
        <Stack.Screen name="scan-check-in" options={{ headerShown: true, title: t('Scan QR') }} />
      </Stack.Protected>
      {/*
        Coaching tools. Owners and supervisors coach too, so a gym without trainers still runs.
        Trainers follow their members; owners and supervisors follow everyone they oversee.
        Owners schedule any class; trainers and supervisors schedule and edit their own.
      */}
      <Stack.Protected guard={!!role && canCoach(role)}>
        {/* Trainers invite members only; the server checks who may invite whom. */}
        <Stack.Screen
          name="invite-person"
          options={{ presentation: 'modal', headerShown: true, title: t('Invite someone') }}
        />
        <Stack.Screen name="smart-plans" options={{ headerShown: true, title: t('Smart plans') }} />
        {/* Owners and supervisors see every referral; trainers their own members'. */}
        <Stack.Screen name="referrals" options={{ headerShown: true, title: t('Referrals') }} />
        <Stack.Screen
          name="assign-plan/[workoutId]"
          options={{ headerShown: true, title: t('Assign') }}
        />
        <Stack.Screen
          name="meal-plan-editor"
          options={{ headerShown: true, title: t('Diet plan') }}
        />
        <Stack.Screen
          name="assign-meal-plan/[planId]"
          options={{ headerShown: true, title: t('Assign') }}
        />
        <Stack.Screen
          name="weekly-hours"
          options={{ headerShown: true, title: t('Weekly hours') }}
        />
        <Stack.Screen
          name="member-progress/[memberId]"
          options={{ headerShown: true, title: t('Progress') }}
        />
        <Stack.Screen name="class-editor" options={{ headerShown: true, title: t('Class') }} />
      </Stack.Protected>
      <Stack.Protected guard={!!role}>
        {/* Everyone trains, whatever their role. */}
        <Stack.Screen
          name="workout-session"
          options={{ headerShown: true, gestureEnabled: false, title: t('Workout') }}
        />
        {/*
          Plans: coaches write theirs; members with self workouts on edit their own week,
          which their trainers can edit too. The server checks who may save what.
        */}
        <Stack.Screen name="plan-editor" options={{ headerShown: true, title: t('Plan') }} />
        <Stack.Screen
          name="add-exercises"
          options={{ presentation: 'modal', headerShown: true, title: t('Add exercises') }}
        />
        <Stack.Screen name="self-plan" options={{ headerShown: true, title: t('My plan') }} />
        <Stack.Screen
          name="self-plan-setup"
          options={{ headerShown: true, title: t('Set up my plan') }}
        />
        <Stack.Screen
          name="exercise/[exerciseId]"
          options={{ headerShown: true, title: t('Exercise') }}
        />
        <Stack.Screen name="notifications" options={{ headerShown: true, title: t('Inbox') }} />
        {/* Everyone can track their body; the database decides whose they may see. */}
        <Stack.Screen
          name="log-measurements"
          options={{ presentation: 'modal', headerShown: true, title: t('Log measurements') }}
        />
        <Stack.Screen
          name="add-progress-photo"
          options={{ presentation: 'modal', headerShown: true, title: t('Add a photo') }}
        />
        <Stack.Screen
          name="progress-photo/[photoId]"
          options={{ headerShown: true, title: t('Photo') }}
        />
        <Stack.Screen
          name="announcements"
          options={{ headerShown: true, title: t('Announcements') }}
        />
        <Stack.Screen
          name="payment/[paymentId]"
          options={{ headerShown: true, title: t('Payment') }}
        />
        <Stack.Screen name="payment-return" options={{ title: t('Payment') }} />
        <Stack.Screen
          name="receipt/[membershipId]"
          options={{ headerShown: true, title: t('Receipt') }}
        />
        <Stack.Screen
          name="payment-history/index"
          options={{ headerShown: true, title: t('Payment history') }}
        />
        {/* Where a branch QR's corefit://check-in link lands. The server says who may check in. */}
        <Stack.Screen name="check-in" options={{ headerShown: true, title: t('Check in') }} />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen
          name="account"
          options={{ presentation: 'modal', headerShown: true, title: t('Account') }}
        />
      </Stack.Protected>
    </Stack>
  );
}
