import { useMemo, useState } from 'react';

import { Button } from '@/components/button';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { ClassRow } from '@/features/bookings/components/class-row';
import { DateStrip } from '@/features/bookings/components/date-strip';
import {
  useBookClass,
  useCancelBooking,
  useMyBookings,
  useUpcomingClasses,
} from '@/features/bookings/hooks';
import { canBook, classesOnDay, upcomingDays } from '@/features/bookings/rules';
import { SessionRow } from '@/features/trainers/components/session-row';
import { TrainerCard } from '@/features/trainers/components/trainer-card';
import { useSessions, useTrainers, useUpdateSession } from '@/features/trainers/hooks';

type Tab = 'trainers' | 'classes';

const blockedLabel = { started: 'Started', full: 'Class full', alreadyBooked: 'Booked' } as const;

export default function MemberBookingsScreen() {
  const [tab, setTab] = useState<Tab>('trainers');

  return (
    <Screen>
      <SegmentedControl
        options={[
          { value: 'trainers', label: 'Personal training' },
          { value: 'classes', label: 'Classes' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'trainers' ? <TrainersTab /> : <ClassesTab />}
    </Screen>
  );
}

function TrainersTab() {
  const profile = useProfile();
  const gym = useActiveGym();
  const sessions = useSessions(gym.gymId, { memberId: profile.id });
  const trainers = useTrainers(gym.gymId);
  const update = useUpdateSession();

  return (
    <>
      {sessions.data?.length ? <SectionHeader title="Your sessions" /> : null}
      {sessions.data?.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          show="trainer"
          highlighted
          action={
            <Button
              label="Cancel session"
              variant="danger"
              size="compact"
              loading={update.isPending && update.variables?.sessionId === session.id}
              onPress={() => update.mutate({ sessionId: session.id, status: 'cancelled' })}
            />
          }
        />
      ))}

      <SectionHeader title="Trainers" />
      <QueryState
        query={trainers}
        isEmpty={(list) => list.length === 0}
        emptyText="No trainers are taking bookings yet.">
        {(list) => list.map((trainer) => <TrainerCard key={trainer.id} trainer={trainer} />)}
      </QueryState>
    </>
  );
}

function ClassesTab() {
  const profile = useProfile();
  const gym = useActiveGym();
  const days = useMemo(() => upcomingDays(7), []);
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const classes = useUpcomingClasses(gym.gymId);
  const myBookings = useMyBookings(gym.gymId, profile.id);
  const book = useBookClass(profile.id);
  const cancel = useCancelBooking();

  return (
    <>
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
    </>
  );
}
