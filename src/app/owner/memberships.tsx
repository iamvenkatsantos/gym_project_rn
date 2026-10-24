import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { useActiveGym } from '@/features/auth/use-profile';
import { MembershipRow } from '@/features/memberships/components/membership-card';
import { PlanCard } from '@/features/memberships/components/plan-card';
import { useMemberships, usePlans } from '@/features/memberships/hooks';
import { latestByMember } from '@/features/memberships/rules';

export default function OwnerMembershipsScreen() {
  const gym = useActiveGym();
  const memberships = useMemberships(gym.gymId);
  const plans = usePlans(gym.gymId);
  const renew = (memberId: string) =>
    router.push({ pathname: '/record-membership', params: { memberId } });

  return (
    <Screen>
      <Button
        label="Record a payment"
        icon="receipt-outline"
        onPress={() => router.push('/record-membership')}
      />

      <SectionHeader title="Plans for sale" />
      <QueryState
        query={plans}
        isEmpty={(list) => list.length === 0}
        emptyText="No plans yet. Add your first one so you can record memberships.">
        {(list) =>
          list.map((plan) => (
            <Pressable
              key={plan.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${plan.name} plan`}
              onPress={() =>
                router.push({ pathname: '/membership-plan-editor', params: { planId: plan.id } })
              }>
              <PlanCard plan={plan} />
            </Pressable>
          ))
        }
      </QueryState>
      <Button
        label="Add a plan"
        icon="add"
        variant="secondary"
        size="compact"
        onPress={() => router.push('/membership-plan-editor')}
      />

      <SectionHeader
        title="Members"
        detail={memberships.data ? `${latestByMember(memberships.data).size} total` : undefined}
      />
      <QueryState
        query={memberships}
        isEmpty={(m) => m.length === 0}
        emptyText="No memberships recorded yet.">
        {(list) =>
          [...latestByMember(list).values()]
            .sort((a, b) => a.endsOn.localeCompare(b.endsOn))
            .map((m) => (
              <MembershipRow key={m.id} membership={m} onRenew={() => renew(m.memberId)} />
            ))
        }
      </QueryState>
    </Screen>
  );
}
