import { router } from 'expo-router';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { useProfile } from '@/features/auth/use-profile';
import { MembershipCard } from '@/features/memberships/components/membership-card';
import { PlanCard } from '@/features/memberships/components/plan-card';
import { useCurrentMembership, usePlans } from '@/features/memberships/hooks';

export default function MemberProfileScreen() {
  const profile = useProfile();
  const membership = useCurrentMembership(profile.id);
  const plans = usePlans();

  return (
    <Screen>
      <SectionHeader title="Membership" />
      <QueryState
        query={membership}
        isEmpty={(m) => !m}
        emptyText="You don't have a membership yet.">
        {(m) => m && <MembershipCard membership={m} />}
      </QueryState>

      <SectionHeader title="Plans" />
      <QueryState query={plans}>
        {(list) =>
          list.map((plan) => (
            <PlanCard key={plan.id} plan={plan} current={plan.id === membership.data?.plan.id} />
          ))
        }
      </QueryState>
      <ThemedText type="small" themeColor="textSecondary">
        To start or renew a plan, speak to the front desk.
      </ThemedText>

      <SectionHeader title="Settings" />
      <Button
        label="Account and privacy"
        variant="secondary"
        icon="settings-outline"
        onPress={() => router.push('/account')}
      />
    </Screen>
  );
}
