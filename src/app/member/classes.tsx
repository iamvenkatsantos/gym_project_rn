import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useProfile } from '@/features/auth/use-profile';
import { ClassCard } from '@/features/bookings/components/class-card';
import {
  useBookClass,
  useCancelBooking,
  useMyBookings,
  useUpcomingClasses,
} from '@/features/bookings/hooks';
import { canBook } from '@/features/bookings/rules';

const blockedLabel = { started: 'Started', full: 'Full', alreadyBooked: 'Booked' } as const;

export default function MemberClassesScreen() {
  const profile = useProfile();
  const classes = useUpcomingClasses();
  const myBookings = useMyBookings(profile.id);
  const book = useBookClass(profile.id);
  const cancel = useCancelBooking();

  return (
    <Screen>
      <ThemedText type="smallBold">My bookings</ThemedText>
      <QueryState query={myBookings} isEmpty={(b) => b.length === 0} emptyText="No bookings yet.">
        {(bookings) =>
          bookings.map((booking) => (
            <ClassCard
              key={booking.id}
              gymClass={booking.gymClass}
              action={
                <Button
                  label="Cancel booking"
                  variant="secondary"
                  loading={cancel.isPending && cancel.variables === booking.id}
                  onPress={() => cancel.mutate(booking.id)}
                />
              }
            />
          ))
        }
      </QueryState>

      <ThemedText type="smallBold">Upcoming</ThemedText>
      <QueryState query={classes} isEmpty={(c) => c.length === 0} emptyText="No classes scheduled.">
        {(list) =>
          list.map((gymClass) => {
            const eligibility = canBook(gymClass, myBookings.data ?? []);
            return (
              <ClassCard
                key={gymClass.id}
                gymClass={gymClass}
                action={
                  <Button
                    label={eligibility.ok ? 'Book' : blockedLabel[eligibility.reason]}
                    disabled={!eligibility.ok}
                    loading={book.isPending && book.variables === gymClass.id}
                    onPress={() => book.mutate(gymClass.id)}
                  />
                }
              />
            );
          })
        }
      </QueryState>
      {book.error ? <ThemedText themeColor="primary">{book.error.message}</ThemedText> : null}
    </Screen>
  );
}
