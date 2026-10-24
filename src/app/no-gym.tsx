import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useSignOut } from '@/features/auth/use-sign-out';

/** Signed in but not (yet) part of any gym. */
export default function NoGymScreen() {
  const signOut = useSignOut();

  return (
    <Screen title="Join your gym">
      <Card>
        <Icon name="mail-unread-outline" size={28} color="primary" />
        <ThemedText type="heading">Waiting for an invite</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your account isn&apos;t linked to a gym yet. Ask the front desk to add you, then sign in
          again.
        </ThemedText>
      </Card>
      <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} />
    </Screen>
  );
}
