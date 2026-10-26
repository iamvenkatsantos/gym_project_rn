import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { restoreProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { useSignOut } from '@/features/auth/use-sign-out';
import { useCanSetUpGym } from '@/features/gyms/hooks';

/** Signed in but not (yet) part of any gym. New gym owners set up their gym from here. */
export default function NoGymScreen() {
  const signOut = useSignOut();
  const canSetUp = useCanSetUpGym();
  const setProfile = useAuthStore((s) => s.setProfile);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  // An invite to an existing account adds them at once, so a fresh profile is all it takes.
  const checkAgain = async () => {
    setChecking(true);
    try {
      const profile = await restoreProfile();
      if (profile) setProfile(profile);
      await canSetUp.refetch();
    } catch {
      // Offline or a hiccup; they can try again.
    } finally {
      setChecking(false);
      setChecked(true);
    }
  };

  if (canSetUp.data) {
    return (
      <Screen title="Welcome to CoreFit Gym">
        <Card>
          <Icon name="business-outline" size={28} color="primary" />
          <ThemedText type="heading">Set up your gym</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            You&apos;ve been invited to run a gym of your own. Add its name and contact details,
            then invite your members and trainers. Nobody from other gyms can see it.
          </ThemedText>
        </Card>
        <Button
          label="Set up my gym"
          icon="arrow-forward"
          onPress={() => router.push('/set-up-gym')}
        />
        <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} />
      </Screen>
    );
  }

  return (
    <Screen title="Join your gym">
      <Card>
        <Icon name="mail-unread-outline" size={28} color="primary" />
        <ThemedText type="heading">Waiting for an invite</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your account isn&apos;t linked to a gym yet. Ask the front desk to invite the email you
          signed up with. Your screens open as soon as they do.
        </ThemedText>
      </Card>
      {checked && !checking ? (
        <ThemedText type="small" themeColor="textSecondary">
          No invite yet. Check the email matches the one you signed up with.
        </ThemedText>
      ) : null}
      <Button label="Check again" icon="refresh-outline" loading={checking} onPress={checkAgain} />
      <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} />
    </Screen>
  );
}
