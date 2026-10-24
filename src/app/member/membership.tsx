import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
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
    </Screen>
  );
}
