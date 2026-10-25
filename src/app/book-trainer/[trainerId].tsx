import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { DateStrip } from '@/features/bookings/components/date-strip';
import { upcomingDays } from '@/features/bookings/rules';
import { SlotGrid } from '@/features/trainers/components/slot-grid';
import { TrainerAvatar } from '@/features/trainers/components/trainer-avatar';
import { useBookSession, useBusySlots, useTrainer } from '@/features/trainers/hooks';
import { slotsForDay } from '@/features/trainers/rules';
import { formatRelativeDay, formatTime } from '@/lib/format';

const DAYS = 14;

export default function BookTrainerScreen() {
  const { trainerId } = useLocalSearchParams<{ trainerId: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const days = useMemo(() => upcomingDays(DAYS), []);
  const [day, setDay] = useState(days[0]);
  const [selected, setSelected] = useState<string | null>(null);

  const trainer = useTrainer(gym.gymId, trainerId);
  const rangeEnd = useMemo(() => {
    const end = new Date(days[DAYS - 1]);
    end.setDate(end.getDate() + 1);
    return end;
  }, [days]);
  const busy = useBusySlots(trainerId, days[0], rangeEnd);
  const book = useBookSession(gym.gymId, profile.id);

  return (
    <Screen>
      <QueryState query={trainer}>
        {(t) => {
          const slots = slotsForDay({
            day,
            availability: t.availability,
            sessionMinutes: t.sessionMinutes,
            busy: busy.data ?? [],
          });
          return (
            <>
              <Card>
                <View style={styles.header}>
                  <TrainerAvatar name={t.fullName} size={56} />
                  <View style={styles.body}>
                    <ThemedText type="heading">{t.fullName}</ThemedText>
                    {t.availability.length ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {t.sessionMinutes} min sessions
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {t.bio}
                </ThemedText>
                <View style={styles.pills}>
                  {t.specialties.map((s) => (
                    <Pill key={s} label={s} />
                  ))}
                </View>
              </Card>

              <SectionHeader title="Pick a day" />
              <DateStrip
                days={days}
                selected={day}
                onSelect={(d) => {
                  setDay(d);
                  setSelected(null);
                }}
              />

              <SectionHeader title="Pick a time" />
              {t.availability.length === 0 ? (
                <ThemedText themeColor="textSecondary">
                  {t.fullName.split(' ')[0]} hasn&apos;t set bookable hours yet. Ask them at the gym
                  or book a class meanwhile.
                </ThemedText>
              ) : slots.length === 0 ? (
                <ThemedText themeColor="textSecondary">
                  {t.fullName.split(' ')[0]} isn&apos;t available this day.
                </ThemedText>
              ) : (
                <SlotGrid slots={slots} selected={selected} onSelect={setSelected} />
              )}

              {book.isSuccess ? (
                <Card highlighted>
                  <ThemedText type="heading">You&apos;re booked</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {book.variables && formatRelativeDay(book.variables.startsAt)} at{' '}
                    {book.variables && formatTime(book.variables.startsAt)} with {t.fullName}.
                  </ThemedText>
                  <Button label="Done" onPress={() => router.back()} />
                </Card>
              ) : (
                <Button
                  label={
                    selected
                      ? `Book ${formatRelativeDay(selected)} at ${formatTime(selected)}`
                      : 'Choose a time'
                  }
                  icon="checkmark-circle-outline"
                  disabled={!selected}
                  loading={book.isPending}
                  onPress={() => selected && book.mutate({ trainerId: t.id, startsAt: selected })}
                />
              )}
              {book.error ? (
                <ThemedText themeColor="danger">{book.error.message}</ThemedText>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                You can cancel from Bookings any time before the session starts.
              </ThemedText>
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  body: {
    flex: 1,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
