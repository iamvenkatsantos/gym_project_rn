import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { CheckInCard } from '@/features/attendance/components/check-in-card';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { ClassRow } from '@/features/bookings/components/class-row';
import { YourTrainers } from '@/features/coaching/components/your-trainers';
import { useMyBookings } from '@/features/bookings/hooks';
import { MembershipCard } from '@/features/memberships/components/membership-card';
import { useCurrentMembership } from '@/features/memberships/hooks';
import { SessionRow } from '@/features/trainers/components/session-row';
import { useSessions } from '@/features/trainers/hooks';
import { greeting } from '@/lib/greeting';

export default function MemberHomeScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const membership = useCurrentMembership(gym.gymId, profile.id);
  const bookings = useMyBookings(gym.gymId, profile.id);
  const sessions = useSessions(gym.gymId, { memberId: profile.id });

  const nextSession = sessions.data?.[0];
  const upcoming = (bookings.data?.length ?? 0) + (sessions.data?.length ?? 0);

  return (
    <Screen eyebrow={greeting()} title={profile.fullName.split(' ')[0]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.gym}>
        {gym.gymName}
      </ThemedText>

      <CheckInCard gymId={gym.gymId} userId={profile.id} role="member" />

      <SectionHeader title="Membership" />
      <QueryState
        query={membership}
        isEmpty={(m) => !m}
        emptyText="You don't have a membership yet.">
        {(m) => m && <MembershipCard membership={m} />}
      </QueryState>

      <YourTrainers gymId={gym.gymId} memberId={profile.id} />

      <SectionHeader title="Coming up" detail={upcoming ? `${upcoming} booked` : undefined} />
      {nextSession ? <SessionRow session={nextSession} show="trainer" highlighted /> : null}
      <QueryState
        query={bookings}
        isEmpty={(b) => b.length === 0 && !nextSession}
        emptyText="Nothing booked yet.">
        {(list) =>
          list
            .slice(0, 2)
            .map((booking, i) => (
              <ClassRow
                key={booking.id}
                gymClass={booking.gymClass}
                showDay
                highlighted={!nextSession && i === 0}
              />
            ))
        }
      </QueryState>
      <View style={styles.actions}>
        <Button
          label="Book a trainer or class"
          icon="add-circle-outline"
          onPress={() => router.navigate('/member/bookings')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gym: {
    marginTop: -Spacing.three,
  },
  actions: {
    gap: Spacing.two,
  },
});
