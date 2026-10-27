import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { DateStrip } from '@/features/bookings/components/date-strip';
import {
  useCancelClass,
  useScheduleClasses,
  useUpcomingClasses,
  useUpdateClass,
} from '@/features/bookings/hooks';
import {
  atMinutes,
  classProblem,
  formatClock,
  minutesOfDay,
  upcomingDays,
  weeklyStarts,
} from '@/features/bookings/rules';
import type { GymClass } from '@/features/bookings/types';
import { usePeople } from '@/features/members/hooks';
import { activeCoaches, coachLabel } from '@/features/members/rules';
import { formatDate } from '@/lib/format';
import { firstError, validateTitle } from '@/lib/validation';

export default function ClassEditorScreen() {
  const { classId, trainerId } = useLocalSearchParams<{ classId?: string; trainerId?: string }>();
  const gym = useActiveGym();
  const classes = useUpcomingClasses(gym.gymId);
  const gymClass = classes.data?.find((c) => c.id === classId);

  if (classId && !gymClass) {
    return (
      <Screen refreshable={false}>
        <ThemedText themeColor="textSecondary">
          {classes.isPending ? 'Loading…' : 'This class has already started or was cancelled.'}
        </ThemedText>
      </Screen>
    );
  }
  return (
    <ClassForm
      key={gymClass?.id ?? 'new'}
      gymId={gym.gymId}
      gymClass={gymClass}
      defaultTrainerId={trainerId}
    />
  );
}

function ClassForm({
  gymId,
  gymClass,
  defaultTrainerId,
}: {
  gymId: string;
  gymClass?: GymClass;
  defaultTrainerId?: string;
}) {
  const profile = useProfile();
  const gym = useActiveGym();
  // Trainers and supervisors schedule and edit their own classes; owners can pick any coach.
  const asTrainer = gym.role !== 'owner';
  const people = usePeople(gymId);
  const days = useMemo(() => upcomingDays(28), []);
  const initialStart = gymClass ? new Date(gymClass.startsAt) : null;
  const [title, setTitle] = useState(gymClass?.title ?? '');
  const [trainerId, setTrainerId] = useState<string | null>(
    asTrainer ? profile.id : (gymClass?.trainerId ?? defaultTrainerId ?? null),
  );
  const [day, setDay] = useState(
    initialStart
      ? new Date(initialStart.getFullYear(), initialStart.getMonth(), initialStart.getDate())
      : days[1],
  );
  const [minutes, setMinutes] = useState(gymClass ? minutesOfDay(gymClass.startsAt) : 7 * 60);
  const [durationMinutes, setDuration] = useState(gymClass?.durationMinutes ?? 45);
  const [capacity, setCapacity] = useState(gymClass?.capacity ?? 15);
  const [weeks, setWeeks] = useState(1);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const schedule = useScheduleClasses(gymId);
  const update = useUpdateClass();
  const cancel = useCancelClass();

  const trainers = activeCoaches(people.data ?? []);
  const startsAt = atMinutes(day, minutes);
  const titleError = validateTitle(title, { label: 'class name', max: 40 });
  const problem = firstError(titleError, classProblem({ title, startsAt }));
  const lastStart = weeklyStarts(startsAt, weeks).at(-1)!;
  const input = {
    title,
    trainerId,
    startsAt: startsAt.toISOString(),
    durationMinutes,
    capacity,
  };
  const error = schedule.error ?? update.error ?? cancel.error;

  return (
    <Screen refreshable={false}>
      <Stack.Screen options={{ title: gymClass ? 'Edit class' : 'Schedule a class' }} />
      <TextField
        label="Class name"
        placeholder="e.g. Morning HIIT, Yoga, Spin"
        value={title}
        onChangeText={setTitle}
        maxLength={40}
        error={titleError}
      />

      {asTrainer ? null : (
        <View style={styles.field}>
          <ThemedText type="label" themeColor="textSecondary">
            Trainer
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            <Chip
              label="No trainer"
              selected={trainerId === null}
              onPress={() => setTrainerId(null)}
            />
            {trainers.map((t) => (
              <Chip
                key={t.id}
                label={coachLabel(t, profile.id)}
                selected={trainerId === t.id}
                onPress={() => setTrainerId(t.id)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Day
        </ThemedText>
        <DateStrip days={days} selected={day} onSelect={setDay} />
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(startsAt.toISOString())}
        </ThemedText>
      </View>

      <View style={styles.grid}>
        <View style={styles.cell}>
          <ThemedText type="label" themeColor="textSecondary">
            Starts at
          </ThemedText>
          <Stepper
            label="Start time"
            value={minutes}
            step={15}
            min={5 * 60}
            max={23 * 60}
            format={formatClock}
            onChange={setMinutes}
          />
        </View>
        <View style={styles.cell}>
          <ThemedText type="label" themeColor="textSecondary">
            Length
          </ThemedText>
          <Stepper
            label="Length"
            value={durationMinutes}
            step={15}
            min={15}
            max={180}
            format={(m) => `${m} min`}
            onChange={setDuration}
          />
        </View>
        <View style={styles.cell}>
          <ThemedText type="label" themeColor="textSecondary">
            Spots
          </ThemedText>
          <Stepper
            label="Spots"
            value={capacity}
            min={Math.max(1, gymClass?.bookedCount ?? 1)}
            max={200}
            onChange={setCapacity}
          />
        </View>
        {gymClass ? null : (
          <View style={styles.cell}>
            <ThemedText type="label" themeColor="textSecondary">
              Repeat
            </ThemedText>
            <Stepper
              label="Repeat weekly"
              value={weeks}
              min={1}
              max={26}
              format={(w) => (w === 1 ? 'Once' : `${w} weeks`)}
              onChange={setWeeks}
            />
          </View>
        )}
      </View>
      {weeks > 1 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Every {startsAt.toLocaleDateString(undefined, { weekday: 'long' })} at{' '}
          {formatClock(minutes)}, until {formatDate(lastStart.toISOString())}.
        </ThemedText>
      ) : null}
      {gymClass?.bookedCount ? (
        <ThemedText type="small" themeColor="textSecondary">
          {gymClass.bookedCount} booked, so spots can&apos;t go lower than that.
        </ThemedText>
      ) : null}

      {problem && title && !titleError ? (
        <ThemedText themeColor="textSecondary">{problem}</ThemedText>
      ) : null}
      {error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {error.message}</ThemedText>
      ) : null}
      <Button
        label={
          gymClass ? 'Save changes' : weeks > 1 ? `Schedule ${weeks} classes` : 'Schedule class'
        }
        icon="checkmark"
        disabled={!!problem}
        loading={schedule.isPending || update.isPending}
        onPress={() =>
          gymClass
            ? update.mutate({ classId: gymClass.id, input }, { onSuccess: () => router.back() })
            : schedule.mutate({ input, weeks }, { onSuccess: () => router.back() })
        }
      />

      {gymClass ? (
        confirmCancel ? (
          <Card>
            <ThemedText type="smallBold">Cancel {gymClass.title}?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {gymClass.bookedCount
                ? `The ${gymClass.bookedCount} people booked lose their spot. Let them know at the front desk or on your group chat.`
                : 'Nobody has booked it yet.'}
            </ThemedText>
            <Button
              label="Cancel this class"
              variant="danger"
              size="compact"
              loading={cancel.isPending && cancel.variables?.restOfSeries === false}
              onPress={() =>
                cancel.mutate(
                  { classId: gymClass.id, restOfSeries: false },
                  { onSuccess: () => router.back() },
                )
              }
            />
            {gymClass.seriesId ? (
              <Button
                label="Cancel this and every later week"
                variant="danger"
                size="compact"
                loading={cancel.isPending && cancel.variables?.restOfSeries === true}
                onPress={() =>
                  cancel.mutate(
                    { classId: gymClass.id, restOfSeries: true },
                    { onSuccess: () => router.back() },
                  )
                }
              />
            ) : null}
            <Button
              label="Keep it"
              variant="secondary"
              size="compact"
              onPress={() => setConfirmCancel(false)}
            />
          </Card>
        ) : (
          <Button
            label="Cancel class"
            variant="danger"
            size="compact"
            onPress={() => setConfirmCancel(true)}
          />
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  cell: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: Spacing.one,
  },
});
