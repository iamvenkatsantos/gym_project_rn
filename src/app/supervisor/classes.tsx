import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { ClassRow } from '@/features/bookings/components/class-row';
import { DateStrip } from '@/features/bookings/components/date-strip';
import { useUpcomingClasses } from '@/features/bookings/hooks';
import { classesOnDay, upcomingDays } from '@/features/bookings/rules';

/**
 * Trainers schedule classes; supervisors follow bookings and nudge trainers.
 * Supervisors can also teach, so they schedule and edit their own classes.
 */
export default function SupervisorClassesScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const days = useMemo(() => upcomingDays(14), []);
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const classes = useUpcomingClasses(gym.gymId);

  return (
    <Screen>
      <Button
        label="Ask a trainer to schedule"
        icon="chatbubble-ellipses-outline"
        onPress={() => router.push('/message-trainer')}
      />
      <Button
        label="Teach a class yourself"
        icon="add"
        variant="secondary"
        onPress={() => router.push('/class-editor')}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Tap a class to message its trainer, or to edit one you teach.
      </ThemedText>
      <DateStrip days={days} selected={selectedDay} onSelect={setSelectedDay} />
      <QueryState
        query={classes}
        isEmpty={(list) => classesOnDay(list, selectedDay).length === 0}
        emptyText="No classes this day.">
        {(list) =>
          classesOnDay(list, selectedDay).map((gymClass) => {
            const mine = gymClass.trainerId === profile.id;
            return (
              <Pressable
                key={gymClass.id}
                accessibilityRole="button"
                accessibilityLabel={
                  mine ? `Edit ${gymClass.title}` : `Message the trainer of ${gymClass.title}`
                }
                disabled={!gymClass.trainerId}
                onPress={() =>
                  mine
                    ? router.push({ pathname: '/class-editor', params: { classId: gymClass.id } })
                    : router.push({
                        pathname: '/message-trainer',
                        params: { trainerId: gymClass.trainerId ?? '', classId: gymClass.id },
                      })
                }>
                <ClassRow gymClass={gymClass} />
              </Pressable>
            );
          })
        }
      </QueryState>
    </Screen>
  );
}
