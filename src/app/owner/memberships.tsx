import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { MembershipCard } from '@/features/memberships/components/membership-card';
import { PlanCard } from '@/features/memberships/components/plan-card';
import { useMemberships, usePlans } from '@/features/memberships/hooks';

export default function OwnerMembershipsScreen() {
  const memberships = useMemberships();
  const plans = usePlans();

  return (
    <Screen>
      <QueryState query={memberships} isEmpty={(m) => m.length === 0} emptyText="No members yet.">
        {(list) => list.map((m) => <MembershipCard key={m.id} membership={m} showMember />)}
      </QueryState>

      <ThemedText type="smallBold">Plans</ThemedText>
      <QueryState query={plans}>
        {(list) => list.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
      </QueryState>
    </Screen>
  );
}
