import { StyleSheet, View } from 'react-native';

import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { Spacing } from '@/constants/theme';
import { ClassRow } from '@/features/bookings/components/class-row';
import { useUpcomingClasses } from '@/features/bookings/hooks';
import { classesOnDay } from '@/features/bookings/rules';
import { MembershipRow } from '@/features/memberships/components/membership-card';
import { useMemberships } from '@/features/memberships/hooks';
import { membershipStatus, renewalsDue } from '@/features/memberships/rules';

export default function OwnerDashboardScreen() {
  const memberships = useMemberships();
  const classes = useUpcomingClasses();

  const statuses = memberships.data?.map((m) => membershipStatus(m));
  const activeCount = statuses?.filter((s) => s === 'active' || s === 'expiringSoon').length;
  const today = classes.data ? classesOnDay(classes.data, new Date()) : undefined;
  const bookedToday = today?.reduce((sum, c) => sum + c.bookedCount, 0);

  return (
    <Screen>
      <View style={styles.grid}>
        <StatTile label="Active members" value={activeCount} icon="people" accent />
        <StatTile
          label="Renewals due"
          value={memberships.data && renewalsDue(memberships.data).length}
          icon="alert-circle-outline"
        />
        <StatTile label="Classes today" value={today?.length} icon="calendar-outline" />
        <StatTile label="Booked today" value={bookedToday} icon="checkmark-done-outline" />
      </View>

      <SectionHeader title="Renewals due" />
      <QueryState
        query={memberships}
        isEmpty={(list) => renewalsDue(list).length === 0}
        emptyText="No renewals due this week.">
        {(list) => renewalsDue(list).map((m) => <MembershipRow key={m.id} membership={m} />)}
      </QueryState>

      <SectionHeader title="Up next" />
      <QueryState
        query={classes}
        isEmpty={(list) => list.length === 0}
        emptyText="No classes scheduled.">
        {(list) =>
          list
            .slice(0, 3)
            .map((gymClass) => <ClassRow key={gymClass.id} gymClass={gymClass} showDay />)
        }
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
});
