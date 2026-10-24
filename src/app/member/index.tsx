import { Screen } from '@/components/screen';
import { QueryState } from '@/components/query-state';
import { ThemedText } from '@/components/themed-text';
import { useProfile } from '@/features/auth/use-profile';
import { ClassCard } from '@/features/bookings/components/class-card';
import { useMyBookings } from '@/features/bookings/hooks';
import { MembershipCard } from '@/features/memberships/components/membership-card';
import { useCurrentMembership } from '@/features/memberships/hooks';

export default function MemberHomeScreen() {
  const profile = useProfile();
  const membership = useCurrentMembership(profile.id);
  const bookings = useMyBookings(profile.id);

  return (
    <Screen title={`Hi, ${profile.fullName.split(' ')[0]}`}>
      <ThemedText type="smallBold">Your membership</ThemedText>
      <QueryState
        query={membership}
        isEmpty={(m) => !m}
        emptyText="You don't have a membership yet.">
        {(m) => m && <MembershipCard membership={m} />}
      </QueryState>

      <ThemedText type="smallBold">Next class</ThemedText>
      <QueryState query={bookings} isEmpty={(b) => b.length === 0} emptyText="No classes booked.">
        {([next]) => <ClassCard gymClass={next.gymClass} />}
      </QueryState>
    </Screen>
  );
}
