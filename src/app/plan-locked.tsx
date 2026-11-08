import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { BranchSwitcher } from '@/features/branches/components/branch-switcher';
import { useSignOut } from '@/features/auth/use-sign-out';
import { PlanAndPay } from '@/features/subscription/components/plan-and-pay';
import { useSubscription } from '@/features/subscription/hooks';
import { canPayPlanInApp } from '@/features/subscription/platform';

/**
 * The whole app at a branch whose CoreFit plan ran out more than 5 days ago. The owner
 * pays here (not on iOS, see `canPayPlanInApp`); everyone else waits for them. Paying unlocks
 * it for everyone.
 */
export default function PlanLockedScreen() {
  const gym = useActiveGym();
  const isOwner = gym.role === 'owner';
  const signOut = useSignOut();

  return (
    <Screen>
      <BranchSwitcher />
      <Card style={styles.hero}>
        <Icon name="lock-closed-outline" size={40} color="danger" />
        <ThemedText type="heading" style={styles.center}>
          {gym.gymName} is paused
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {!isOwner
            ? 'Your gym’s CoreFit plan isn’t paid. Ask the owner to renew.'
            : canPayPlanInApp
              ? 'Your CoreFit plan isn’t paid. Pay to open the app for everyone.'
              : 'Your CoreFit plan has ended. It opens for everyone once renewed.'}
        </ThemedText>
      </Card>
      {isOwner ? <OwnerPay gymId={gym.gymId} gymName={gym.gymName} /> : null}
      <View style={styles.actions}>
        <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} />
      </View>
    </Screen>
  );
}

function OwnerPay({ gymId, gymName }: { gymId: string; gymName: string }) {
  const subscription = useSubscription(gymId);
  return (
    <QueryState query={subscription}>
      {(sub) => <PlanAndPay gymId={gymId} gymName={gymName} sub={sub} />}
    </QueryState>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  actions: {
    gap: Spacing.two,
  },
});
