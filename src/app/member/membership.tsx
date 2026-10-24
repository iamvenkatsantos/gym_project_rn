import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useProfile } from '@/features/auth/use-profile';
import { MembershipCard } from '@/features/memberships/components/membership-card';
import { PlanCard } from '@/features/memberships/components/plan-card';
import { useCurrentMembership, usePlans } from '@/features/memberships/hooks';

export default function MemberMembershipScreen() {
  const profile = useProfile();
  const membership = useCurrentMembership(profile.id);
  const plans = usePlans();

  return (
    <Screen>
      <QueryState
        query={membership}
        isEmpty={(m) => !m}
        emptyText="You don't have a membership yet.">
        {(m) => m && <MembershipCard membership={m} />}
      </QueryState>

      <ThemedText type="smallBold">Plans</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Ask at the front desk to start or renew a plan.
      </ThemedText>
      <QueryState query={plans}>
        {(list) => list.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
      </QueryState>
    </Screen>
  );
}
