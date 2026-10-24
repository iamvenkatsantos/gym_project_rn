import { useState } from 'react';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { restoreProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { useSignOut } from '@/features/auth/use-sign-out';

/** Signed in but not (yet) part of any gym. */
export default function NoGymScreen() {
  const signOut = useSignOut();
  const setProfile = useAuthStore((s) => s.setProfile);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);

  // An invite to an existing account adds them at once, so a fresh profile is all it takes.
  const checkAgain = async () => {
    setChecking(true);
    try {
      const profile = await restoreProfile();
      if (profile) setProfile(profile);
    } catch {
      // Offline or a hiccup; they can try again.
    } finally {
      setChecking(false);
      setChecked(true);
    }
  };

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
