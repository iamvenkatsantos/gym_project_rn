import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

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
import { useWorkoutLogs } from '@/features/progress/hooks';
import { weekStreak, workoutsThisWeek } from '@/features/progress/rules';

export default function MemberProfileScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const membership = useCurrentMembership(gym.gymId, profile.id);
  const plans = usePlans(gym.gymId);
  const logs = useWorkoutLogs(gym.gymId, profile.id).data;

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

      <SectionHeader title="Plans" detail="Ask the front desk to start or renew" />
      <QueryState query={plans}>
        {(list) =>
          list.map((plan) => (
            <PlanCard key={plan.id} plan={plan} current={plan.id === membership.data?.plan.id} />
          ))
        }
      </QueryState>

      <SectionHeader title="Appearance" />
      <AppearancePicker />

      <SectionHeader title="More" />
      <ListGroup>
        <ListRow
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
