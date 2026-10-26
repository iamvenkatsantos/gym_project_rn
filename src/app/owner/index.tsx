import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
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
  const present = attendance.data ? countByRole(attendance.data) : undefined;

  const latest = memberships.data ? [...latestByMember(memberships.data).values()] : undefined;
  const statuses = latest?.map((m) => membershipStatus(m));
  const activeCount = statuses?.filter((s) => s === 'active' || s === 'expiringSoon').length;
  const renewals = memberships.data ? renewalsDue(memberships.data) : undefined;
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
        <StatTile label="Renewals due" value={renewals?.length} icon="alert-circle-outline" />
        <StatTile label="Classes today" value={today?.length} icon="calendar-outline" />
        <StatTile label="Booked today" value={bookedToday} icon="checkmark-done-outline" />
        <StatTile label="Trainer requests" value={waiting?.length} icon="hand-right-outline" />
        <StatTile label="No trainer yet" value={noTrainer} icon="person-outline" />
        <StatTile
          label="Members came today"
          value={present?.member.present}
          icon="log-in-outline"
        />
        <StatTile
          label="Trainers in today"
          value={present && `${present.trainer.present}/${present.trainer.total}`}
          icon="barbell-outline"
        />
      </View>

      {attendance.data ? (
        <DayAttendanceList
          title="Trainers today"
          entries={attendance.data.filter((e) => e.role === 'trainer')}
          emptyText="No trainers at this gym yet."
        />
      ) : null}
      <Button
        label="Announcements"
        icon="megaphone-outline"
        variant="secondary"
        onPress={() => router.push('/announcements')}
      />
      <Button
        label="Attendance report"
        icon="calendar-number-outline"
        variant="secondary"
        onPress={() => router.push('/attendance')}
      />
      {gym.role === 'owner' ? (
        <Button
          label="Export reports"
          icon="download-outline"
          variant="secondary"
          onPress={() => router.push('/reports')}
        />
      ) : null}
      {gym.role === 'owner' ? (
        <Button
          label="Gym details"
          icon="business-outline"
          variant="secondary"
          onPress={() => router.push('/gym-details')}
        />
      ) : null}

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
