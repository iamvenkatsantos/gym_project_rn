import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { useGymReferrals } from '@/features/referrals/hooks';
import { ShortcutGrid, type Shortcut } from '@/components/shortcut-grid';
import { StatTile } from '@/components/stat-tile';
import { Spacing } from '@/constants/theme';
import { ClassRow } from '@/features/bookings/components/class-row';
import { useActiveGym } from '@/features/auth/use-profile';
import { useUpcomingClasses } from '@/features/bookings/hooks';
import { BranchSwitcher } from '@/features/branches/components/branch-switcher';
import { classesOnDay } from '@/features/bookings/rules';
import { TrainerRequestRow } from '@/features/coaching/components/trainer-request-row';
import { useTrainerRequests } from '@/features/coaching/hooks';
import { pendingRequests } from '@/features/coaching/rules';
import { useDashboardCounts, useRenewalsDue } from '@/features/dashboard/hooks';
import { useEnquiries } from '@/features/enquiries/hooks';
import { countEnquiries } from '@/features/enquiries/rules';
import { MembershipSetup } from '@/features/memberships/components/membership-setup';
import { RenewalRow } from '@/features/memberships/components/renewal-row';
import { usePlans } from '@/features/memberships/hooks';
import { PlanBanner } from '@/features/subscription/components/plan-banner';
import { usePermissions } from '@/features/trainer-hours/hooks';
import { pendingCount } from '@/features/trainer-hours/rules';

/** How much of each list the dashboard shows before the screen behind it. */
const RENEWALS_SHOWN = 2;
const REQUESTS_SHOWN = 2;
const CLASSES_SHOWN = 2;

/** The owner's and the supervisor's home: money, attendance, trainer matching and today's classes. */
export default function OwnerDashboardScreen() {
  const gym = useActiveGym();
  // The tile numbers and the first renewals come from the server, not the full people,
  // membership, attendance and trainer-link lists (~400 KB at 300 members).
  const counts = useDashboardCounts(gym.gymId).data;
  const renewalsDue = useRenewalsDue(gym.gymId, RENEWALS_SHOWN);
  const plans = usePlans(gym.gymId);
  const classes = useUpcomingClasses(gym.gymId);
  const requests = useTrainerRequests(gym.gymId);
  const enquiries = useEnquiries(gym.gymId);
  // Trainer hours and permissions are owners' only.
  const permissions = usePermissions(gym.gymId, undefined, gym.role === 'owner');
  const enquiryCounts = enquiries.data ? countEnquiries(enquiries.data) : undefined;

  const referrals = useGymReferrals(gym.gymId);
  const renewalCount = renewalsDue.data?.total;
  const today = classes.data ? classesOnDay(classes.data, new Date()) : undefined;
  const waiting = requests.data ? pendingRequests(requests.data) : undefined;

  const referralsToCall = referrals.data?.filter((r) => r.status === 'pending').length;

  const shortcuts: Shortcut[] = [
    {
      label: 'Enquiries',
      icon: 'chatbubbles-outline',
      badge: enquiryCounts?.due,
      onPress: () => router.push('/enquiries'),
    },
    {
      label: 'Announce',
      icon: 'megaphone-outline',
      onPress: () => router.push('/announcements'),
    },
    {
      label: 'Attendance',
      icon: 'calendar-number-outline',
      onPress: () => router.push('/attendance'),
    },
    {
      label: 'Birthdays',
      icon: 'gift-outline',
      badge: counts?.birthdaysToday,
      onPress: () => router.push('/birthdays'),
    },
    {
      label: 'Referrals',
      icon: 'person-add-outline',
      badge: referralsToCall,
      onPress: () => router.push('/referrals'),
    },
  ];
  if (gym.role === 'owner') {
    shortcuts.push(
      { label: 'Insights', icon: 'stats-chart-outline', onPress: () => router.push('/insights') },
      { label: 'Reports', icon: 'download-outline', onPress: () => router.push('/reports') },
      {
        label: 'Trainer hours',
        icon: 'time-outline',
        badge: permissions.data ? pendingCount(permissions.data) : undefined,
        onPress: () => router.push('/trainer-hours'),
      },
      {
        label: 'Gym details',
        icon: 'business-outline',
        onPress: () => router.push('/gym-details'),
      },
      {
        label: 'CoreFit plan',
        icon: 'ribbon-outline',
        onPress: () => router.push('/subscription'),
      },
    );
  }

  return (
    <Screen>
      <BranchSwitcher />
      <PlanBanner />
      {plans.data?.length === 0 ? <MembershipSetup isOwner={gym.role === 'owner'} /> : null}
      {/* Three across so the numbers fit on the first screen of a small phone. Each one opens
          the screen behind it, so the dashboard doesn't need a row of buttons as well. */}
      <View style={styles.grid}>
        <StatTile
          label="Active members"
          value={counts?.activeMembers}
          icon="people"
          accent
          compact
          onPress={() => router.push('/owner/people')}
        />
        <StatTile
          label="Renewals due"
          value={renewalCount}
          icon="alert-circle-outline"
          compact
          onPress={() => router.push('/renewals')}
        />
        <StatTile
          label="No trainer yet"
          value={counts?.noTrainer}
          icon="person-outline"
          compact
          onPress={() => router.push('/match-trainers')}
        />
        <StatTile
          label="Came today"
          value={counts?.membersPresent}
          icon="log-in-outline"
          compact
          onPress={() => router.push('/attendance')}
        />
        <StatTile
          label="Trainers in"
          value={counts && `${counts.trainersPresent}/${counts.trainersTotal}`}
          icon="barbell-outline"
          compact
          onPress={() => router.push('/attendance')}
        />
        <StatTile
          label="Classes today"
          value={today?.length}
          icon="calendar-outline"
          compact
          onPress={() => router.push('/owner/classes')}
        />
      </View>

      <ShortcutGrid shortcuts={shortcuts} />

      {waiting?.length ? (
        <>
          <SectionHeader title="Trainer requests" detail={`${waiting.length} waiting`} />
          {waiting.slice(0, REQUESTS_SHOWN).map((request) => (
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
        detail={renewalCount ? `${renewalCount} members` : undefined}
      />
      <QueryState
        query={renewalsDue}
        isEmpty={(due) => due.total === 0}
        emptyText="No renewals due this week.">
        {(due) =>
          due.memberships.map((m) => (
            // WhatsApp lives on the full Renewals screen to keep the dashboard short.
            <RenewalRow key={m.id} gymId={gym.gymId} gymName={gym.gymName} membership={m} />
          ))
        }
      </QueryState>
      {renewalCount && renewalCount > RENEWALS_SHOWN ? (
        <Button
          label={`See all ${renewalCount} renewals`}
          icon="alert-circle-outline"
          variant="secondary"
          size="compact"
          onPress={() => router.push('/renewals')}
        />
      ) : null}

      <SectionHeader title="Up next" detail="Today's classes" />
      <QueryState
        query={classes}
        isEmpty={(list) => list.length === 0}
        emptyText="No classes scheduled.">
        {(list) =>
          list
            .slice(0, CLASSES_SHOWN)
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
