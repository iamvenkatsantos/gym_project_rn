import { useMemo, useState } from 'react';

import { Button } from '@/components/button';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useProfile } from '@/features/auth/use-profile';
import { ClassRow } from '@/features/bookings/components/class-row';
import { DateStrip } from '@/features/bookings/components/date-strip';
import {
  useBookClass,
  useCancelBooking,
  useMyBookings,
  useUpcomingClasses,
} from '@/features/bookings/hooks';
import { canBook, classesOnDay, upcomingDays } from '@/features/bookings/rules';

const blockedLabel = { started: 'Started', full: 'Class full', alreadyBooked: 'Booked' } as const;

export default function MemberClassesScreen() {
  const profile = useProfile();
  const days = useMemo(() => upcomingDays(7), []);
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const classes = useUpcomingClasses();
  const myBookings = useMyBookings(profile.id);
  const book = useBookClass(profile.id);
  const cancel = useCancelBooking();

  return (
    <Screen>
      <DateStrip days={days} selected={selectedDay} onSelect={setSelectedDay} />
      <QueryState
        query={classes}
        isEmpty={(list) => classesOnDay(list, selectedDay).length === 0}
        emptyText="No more classes this day.">
        {(list) =>
          classesOnDay(list, selectedDay).map((gymClass) => {
            const booking = myBookings.data?.find((b) => b.classId === gymClass.id);
            if (booking) {
              return (
                <ClassRow
                  key={gymClass.id}
                  gymClass={gymClass}
                  highlighted
                  badge={<Pill label="You're booked" tone="accent" icon="checkmark-circle" />}
                  action={
                    <Button
                      label="Cancel booking"
                      variant="danger"
                      size="compact"
                      loading={cancel.isPending && cancel.variables === booking.id}
                      onPress={() => cancel.mutate(booking.id)}
                    />
                  }
                />
              );
            }
            const eligibility = canBook(gymClass, myBookings.data ?? []);
            return (
              <ClassRow
                key={gymClass.id}
                gymClass={gymClass}
                action={
                  <Button
                    label={eligibility.ok ? 'Book class' : blockedLabel[eligibility.reason]}
                    size="compact"
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
      {book.error ? <ThemedText themeColor="danger">{book.error.message}</ThemedText> : null}
    </Screen>
  );
}
