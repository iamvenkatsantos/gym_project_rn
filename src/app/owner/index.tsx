import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ListGroup, ListRow } from '@/components/list-row';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { Spacing } from '@/constants/theme';
import { DayAttendanceList } from '@/features/attendance/components/day-attendance';
import { useDayAttendance } from '@/features/attendance/hooks';
import { countByRole } from '@/features/attendance/rules';
import { ClassRow } from '@/features/bookings/components/class-row';
import { useActiveGym } from '@/features/auth/use-profile';
import { useUpcomingClasses } from '@/features/bookings/hooks';
import { classesOnDay } from '@/features/bookings/rules';
import { TrainerRequestRow } from '@/features/coaching/components/trainer-request-row';
import { useTrainerLinks, useTrainerRequests } from '@/features/coaching/hooks';
import { pendingRequests, unmappedMembers } from '@/features/coaching/rules';
import { useEnquiries } from '@/features/enquiries/hooks';
import { countEnquiries } from '@/features/enquiries/rules';
import { usePeople } from '@/features/members/hooks';
import { MembershipSetup } from '@/features/memberships/components/membership-setup';
import { RenewalRow } from '@/features/memberships/components/renewal-row';
import { useMemberships, usePlans } from '@/features/memberships/hooks';
import { latestByMember, membershipStatus, renewalsDue } from '@/features/memberships/rules';

/** How many renewals the dashboard lists before "See all". */
const RENEWALS_SHOWN = 3;

/** The owner's and the supervisor's home: money, attendance, trainer matching and today's classes. */
export default function OwnerDashboardScreen() {
  const gym = useActiveGym();
  const memberships = useMemberships(gym.gymId);
  const plans = usePlans(gym.gymId);
  const classes = useUpcomingClasses(gym.gymId);
  const people = usePeople(gym.gymId);
  const links = useTrainerLinks(gym.gymId);
  const requests = useTrainerRequests(gym.gymId);
  const attendance = useDayAttendance(gym.gymId, 0);
  const enquiries = useEnquiries(gym.gymId);
  const enquiryCounts = enquiries.data ? countEnquiries(enquiries.data) : undefined;
  const present = attendance.data ? countByRole(attendance.data) : undefined;

  const latest = memberships.data ? [...latestByMember(memberships.data).values()] : undefined;
  const statuses = latest?.map((m) => membershipStatus(m));
  const activeCount = statuses?.filter((s) => s === 'active' || s === 'expiringSoon').length;
  const renewals = memberships.data ? renewalsDue(memberships.data) : undefined;
  const today = classes.data ? classesOnDay(classes.data, new Date()) : undefined;
  const waiting = requests.data ? pendingRequests(requests.data) : undefined;
  const noTrainer =
    people.data && links.data ? unmappedMembers(people.data, links.data).length : undefined;

  return (
    <Screen>
      {plans.data?.length === 0 ? <MembershipSetup isOwner={gym.role === 'owner'} /> : null}
      {/* Three across so the numbers fit on the first screen of a small phone. */}
      <View style={styles.grid}>
        <StatTile label="Active members" value={activeCount} icon="people" accent compact />
        <StatTile
          label="Renewals due"
          value={renewals?.length}
          icon="alert-circle-outline"
          compact
        />
        <StatTile label="No trainer yet" value={noTrainer} icon="person-outline" compact />
        <StatTile
          label="Came today"
          value={present?.member.present}
          icon="log-in-outline"
          compact
        />
        <StatTile
          label="Trainers in"
          value={present && `${present.trainer.present}/${present.trainer.total}`}
          icon="barbell-outline"
          compact
        />
        <StatTile label="Classes today" value={today?.length} icon="calendar-outline" compact />
      </View>

      {attendance.data ? (
        <DayAttendanceList
          title="Trainers today"
          entries={attendance.data.filter((e) => e.role === 'trainer')}
          emptyText="No trainers at this gym yet."
        />
      ) : null}

      <SectionHeader title="Manage" />
      <ListGroup>
        <ListRow
          label="Enquiries and trials"
          detail={enquiryCounts?.due ? `${enquiryCounts.due} to follow up today` : undefined}
          icon="chatbubbles-outline"
          onPress={() => router.push('/enquiries')}
        />
        <ListRow
          label="Announcements"
          icon="megaphone-outline"
          divider
          onPress={() => router.push('/announcements')}
        />
        <ListRow
          label="Attendance report"
          icon="calendar-number-outline"
          divider
          onPress={() => router.push('/attendance')}
        />
        {gym.role === 'owner' ? (
          <>
            <ListRow
              label="Insights"
              icon="stats-chart-outline"
              divider
              onPress={() => router.push('/insights')}
            />
            <ListRow
              label="Export reports"
              icon="download-outline"
              divider
              onPress={() => router.push('/reports')}
            />
            <ListRow
              label="Gym details"
              icon="business-outline"
              divider
              onPress={() => router.push('/gym-details')}
            />
          </>
        ) : null}
      </ListGroup>

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

      <SectionHeader
        title="Renewals due"
        detail={renewals?.length ? `${renewals.length} members` : undefined}
      />
      <QueryState
        query={memberships}
        isEmpty={(list) => renewalsDue(list).length === 0}
        emptyText="No renewals due this week.">
        {(list) =>
          renewalsDue(list)
            .slice(0, RENEWALS_SHOWN)
            .map((m) => <RenewalRow key={m.id} gymId={gym.gymId} membership={m} />)
        }
      </QueryState>
      {renewals?.length ? (
        <Button
          label={
            renewals.length > RENEWALS_SHOWN
              ? `See all ${renewals.length} renewals`
              : 'See all renewals'
          }
          icon="alert-circle-outline"
          variant="secondary"
          size="compact"
          onPress={() => router.push('/renewals')}
        />
      ) : null}

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
