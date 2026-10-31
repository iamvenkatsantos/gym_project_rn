import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Button } from '@/components/button';
import { ListGroup, ListRow } from '@/components/list-row';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { useActiveGym } from '@/features/auth/use-profile';
import { MembershipRow } from '@/features/memberships/components/membership-card';
import { MembershipSetup } from '@/features/memberships/components/membership-setup';
import { PlanCard } from '@/features/memberships/components/plan-card';
import { useLoyaltyOffer, useMemberships, usePlans } from '@/features/memberships/hooks';
import { latestByMember } from '@/features/memberships/rules';

export default function OwnerMembershipsScreen() {
  const gym = useActiveGym();
  const memberships = useMemberships(gym.gymId);
  const plans = usePlans(gym.gymId);
  const loyalty = useLoyaltyOffer(gym.gymId).data;
  // Supervisors record payments; selling plans stays with the owner.
  const isOwner = gym.role === 'owner';
  const renew = (memberId: string) =>
    router.push({ pathname: '/record-membership', params: { memberId } });

  const noPlans = plans.data?.length === 0;

  return (
    <Screen>
      {noPlans ? <MembershipSetup isOwner={isOwner} /> : null}
      <Button
        label="Record a payment"
        icon="receipt-outline"
        disabled={noPlans}
        onPress={() => router.push('/record-membership')}
      />
      <ListGroup>
        <ListRow
          label="Payment history"
          detail="Every member's payments, front desk and in the app"
          icon="time-outline"
          onPress={() => router.push('/payment-history')}
        />
        {isOwner ? (
          <ListRow
            divider
            label="Loyalty offer"
            detail={
              loyalty
                ? `${loyalty.percent}% off after ${loyalty.months} ${loyalty.months === 1 ? 'month' : 'months'} without a break`
                : 'Off · reward members who keep paying'
            }
            icon="heart-outline"
            onPress={() => router.push('/loyalty-offer')}
          />
        ) : null}
      </ListGroup>

      {isOwner && !noPlans ? (
        <>
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
                    router.push({
                      pathname: '/membership-plan-editor',
                      params: { planId: plan.id },
                    })
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
        </>
      ) : null}

      <SectionHeader
        title="Members"
        detail={memberships.data ? `${latestByMember(memberships.data).size} total` : undefined}
      />
      <QueryState
        query={memberships}
        isEmpty={(m) => m.length === 0}
        emptyText={
          noPlans
            ? 'Memberships show here once you record payments.'
            : 'No memberships recorded yet. Tap Record a payment to add one.'
        }>
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
