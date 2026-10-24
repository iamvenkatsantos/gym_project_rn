import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { Spacing } from '@/constants/theme';
import { ClassRow } from '@/features/bookings/components/class-row';
import { useActiveGym } from '@/features/auth/use-profile';
import { useUpcomingClasses } from '@/features/bookings/hooks';
import { classesOnDay } from '@/features/bookings/rules';
import { TrainerRequestRow } from '@/features/coaching/components/trainer-request-row';
import { useTrainerLinks, useTrainerRequests } from '@/features/coaching/hooks';
import { pendingRequests, unmappedMembers } from '@/features/coaching/rules';
import { usePeople } from '@/features/members/hooks';
import { MembershipRow } from '@/features/memberships/components/membership-card';
import { MembershipSetup } from '@/features/memberships/components/membership-setup';
import { useMemberships, usePlans } from '@/features/memberships/hooks';
import { latestByMember, membershipStatus, renewalsDue } from '@/features/memberships/rules';

/** The owner's and the supervisor's home: money, trainer matching and today's classes. */
export default function OwnerDashboardScreen() {
  const gym = useActiveGym();
  const memberships = useMemberships(gym.gymId);
  const plans = usePlans(gym.gymId);
  const classes = useUpcomingClasses(gym.gymId);
  const people = usePeople(gym.gymId);
  const links = useTrainerLinks(gym.gymId);
  const requests = useTrainerRequests(gym.gymId);

  const latest = memberships.data ? [...latestByMember(memberships.data).values()] : undefined;
  const statuses = latest?.map((m) => membershipStatus(m));
  const activeCount = statuses?.filter((s) => s === 'active' || s === 'expiringSoon').length;
  const today = classes.data ? classesOnDay(classes.data, new Date()) : undefined;
  const bookedToday = today?.reduce((sum, c) => sum + c.bookedCount, 0);
  const waiting = requests.data ? pendingRequests(requests.data) : undefined;
  const noTrainer =
    people.data && links.data ? unmappedMembers(people.data, links.data).length : undefined;

  return (
    <Screen>
      {plans.data?.length === 0 ? <MembershipSetup isOwner={gym.role === 'owner'} /> : null}
      <View style={styles.grid}>
        <StatTile label="Active members" value={activeCount} icon="people" accent />
        <StatTile
          label="Renewals due"
          value={memberships.data && renewalsDue(memberships.data).length}
          icon="alert-circle-outline"
        />
        <StatTile label="Classes today" value={today?.length} icon="calendar-outline" />
        <StatTile label="Booked today" value={bookedToday} icon="checkmark-done-outline" />
        <StatTile label="Trainer requests" value={waiting?.length} icon="hand-right-outline" />
        <StatTile label="No trainer yet" value={noTrainer} icon="person-outline" />
      </View>

      {waiting?.length ? (
        <>
          <SectionHeader title="Trainer requests" detail={`${waiting.length} waiting`} />
          {waiting.map((request) => (
            <TrainerRequestRow
              key={request.id}
              request={request}
              onPress={() =>
                router.push({
                  pathname: '/trainer-request/[requestId]',
                  params: { requestId: request.id },
                })
              }
            />
          ))}
        </>
      ) : null}

      <SectionHeader title="Renewals due" />
      <QueryState
        query={memberships}
        isEmpty={(list) => renewalsDue(list).length === 0}
        emptyText="No renewals due this week.">
        {(list) =>
          renewalsDue(list).map((m) => (
            <MembershipRow
              key={m.id}
              membership={m}
              onRenew={() =>
                router.push({ pathname: '/record-membership', params: { memberId: m.memberId } })
              }
            />
          ))
        }
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
