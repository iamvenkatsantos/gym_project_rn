import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ListGroup, ListRow } from '@/components/list-row';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AppearancePicker } from '@/features/appearance/components/appearance-picker';
import { ProfileHeader } from '@/features/auth/components/profile-header';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { MembershipCard } from '@/features/memberships/components/membership-card';
import { PlanCard } from '@/features/memberships/components/plan-card';
import { useCurrentMembership, usePlans } from '@/features/memberships/hooks';
import { membershipStatus } from '@/features/memberships/rules';
import { useOnlinePaymentsEnabled, usePayOnline } from '@/features/payments/hooks';
import { useWorkoutLogs } from '@/features/progress/hooks';
import { weekStreak, workoutsThisWeek } from '@/features/progress/rules';
import { formatAmount } from '@/lib/format';

export default function MemberProfileScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const membership = useCurrentMembership(gym.gymId, profile.id);
  const plans = usePlans(gym.gymId);
  const logs = useWorkoutLogs(gym.gymId, profile.id).data;
  const online = useOnlinePaymentsEnabled(gym.gymId).data === true;
  const pay = usePayOnline(gym.gymId);
  // A plan bought while one is running starts the day after it ends.
  const running = !!membership.data && membershipStatus(membership.data) !== 'expired';

  return (
    <Screen>
      <ProfileHeader profile={profile} gym={gym} />

      <View style={styles.stats}>
        <StatTile
          label="This week"
          value={logs && workoutsThisWeek(logs)}
          icon="flame"
          accent
          compact
        />
        <StatTile
          label="Week streak"
          value={logs && weekStreak(logs)}
          icon="calendar-outline"
          compact
        />
        <StatTile label="Workouts" value={logs?.length} icon="barbell-outline" compact />
      </View>

      <SectionHeader title="Membership" />
      <QueryState
        query={membership}
        isEmpty={(m) => !m}
        emptyText="You don't have a membership yet.">
        {(m) => m && <MembershipCard membership={m} />}
      </QueryState>

      <SectionHeader
        title="Plans"
        detail={online ? 'Pay here or at the front desk' : 'Ask the front desk to start or renew'}
      />
      {online && running ? (
        <ThemedText type="small" themeColor="textSecondary">
          A plan you pay for now starts the day after your current one ends.
        </ThemedText>
      ) : null}
      <QueryState query={plans}>
        {(list) =>
          list.map((plan) => {
            const current = plan.id === membership.data?.plan.id;
            const price = formatAmount(plan.priceCents, plan.currency);
            return (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={current}
                action={
                  online && plan.priceCents >= 100 ? (
                    <Button
                      label={current ? `Renew · ${price}` : `Pay ${price}`}
                      icon="card-outline"
                      size="compact"
                      variant={current ? 'primary' : 'secondary'}
                      loading={pay.isPending && pay.variables === plan.id}
                      disabled={pay.isPending && pay.variables !== plan.id}
                      onPress={() => pay.mutate(plan.id)}
                    />
                  ) : undefined
                }
              />
            );
          })
        }
      </QueryState>
      {pay.error ? (
        <ThemedText type="small" themeColor="danger">
          {pay.error.message}
        </ThemedText>
      ) : null}

      <SectionHeader title="Appearance" />
      <AppearancePicker />

      <SectionHeader title="More" />
      <ListGroup>
        <ListRow
          label="Edit profile"
          detail="Photo, name and mobile number"
          icon="person-circle-outline"
          onPress={() => router.push('/edit-profile')}
        />
        <ListRow
          divider
          label="Payment history"
          detail="Every payment, with receipts for in-app ones"
          icon="receipt-outline"
          onPress={() => router.push('/payment-history')}
        />
        <ListRow
          divider
          label="Inbox"
          detail="Reminders, booking changes and messages"
          icon="notifications-outline"
          onPress={() => router.push('/notifications')}
        />
        <ListRow
          divider
          label="Account and privacy"
          detail="Notifications, your gyms, legal, sign out"
          icon="settings-outline"
          onPress={() => router.push('/account')}
        />
      </ListGroup>
      <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
        {gym.gymName} · CoreFit Gym
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  footer: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
