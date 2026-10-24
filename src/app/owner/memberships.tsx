import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { MembershipRow } from '@/features/memberships/components/membership-card';
import { PlanCard } from '@/features/memberships/components/plan-card';
import { useMemberships, usePlans } from '@/features/memberships/hooks';

export default function OwnerMembershipsScreen() {
  const memberships = useMemberships();
  const plans = usePlans();

  return (
    <Screen>
      <SectionHeader
        title="Members"
        detail={memberships.data ? `${memberships.data.length} total` : undefined}
      />
      <QueryState query={memberships} isEmpty={(m) => m.length === 0} emptyText="No members yet.">
        {(list) => list.map((m) => <MembershipRow key={m.id} membership={m} />)}
      </QueryState>

      <SectionHeader title="Plans" />
      <QueryState query={plans}>
        {(list) => list.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
      </QueryState>
    </Screen>
  );
}
