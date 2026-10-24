import { router } from 'expo-router';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { useProfile } from '@/features/auth/use-profile';
import { ClassRow } from '@/features/bookings/components/class-row';
import { useMyBookings } from '@/features/bookings/hooks';
import { MembershipCard } from '@/features/memberships/components/membership-card';
import { useCurrentMembership } from '@/features/memberships/hooks';
import { greeting } from '@/lib/greeting';

export default function MemberHomeScreen() {
  const profile = useProfile();
  const membership = useCurrentMembership(profile.id);
  const bookings = useMyBookings(profile.id);

  return (
    <Screen eyebrow={greeting()} title={profile.fullName.split(' ')[0]}>
      <SectionHeader title="Membership" />
      <QueryState
        query={membership}
        isEmpty={(m) => !m}
        emptyText="You don't have a membership yet.">
        {(m) => m && <MembershipCard membership={m} />}
      </QueryState>

      <SectionHeader
        title="Your bookings"
        detail={bookings.data?.length ? `${bookings.data.length} upcoming` : undefined}
      />
      <QueryState query={bookings} isEmpty={(b) => b.length === 0} emptyText="No classes booked.">
        {(list) =>
          list
            .slice(0, 3)
            .map((booking, i) => (
              <ClassRow
                key={booking.id}
                gymClass={booking.gymClass}
                showDay
                highlighted={i === 0}
              />
            ))
        }
      </QueryState>
      <Button
        label="Book a class"
        icon="add-circle-outline"
        onPress={() => router.navigate('/member/bookings')}
      />
    </Screen>
  );
}
