import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym } from '@/features/auth/use-profile';
import { ClassRow } from '@/features/bookings/components/class-row';
import { DateStrip } from '@/features/bookings/components/date-strip';
import { useUpcomingClasses } from '@/features/bookings/hooks';
import { classesOnDay, upcomingDays } from '@/features/bookings/rules';

/** Trainers schedule classes; supervisors follow bookings and nudge trainers. */
export default function SupervisorClassesScreen() {
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
      <ThemedText type="small" themeColor="textSecondary">
        Tap a class to message its trainer.
      </ThemedText>
      <DateStrip days={days} selected={selectedDay} onSelect={setSelectedDay} />
      <QueryState
        query={classes}
        isEmpty={(list) => classesOnDay(list, selectedDay).length === 0}
        emptyText="No classes this day.">
        {(list) =>
          classesOnDay(list, selectedDay).map((gymClass) => (
            <Pressable
              key={gymClass.id}
              accessibilityRole="button"
              accessibilityLabel={`Message the trainer of ${gymClass.title}`}
              disabled={!gymClass.trainerId}
              onPress={() =>
                router.push({
                  pathname: '/message-trainer',
                  params: { trainerId: gymClass.trainerId ?? '', classId: gymClass.id },
                })
              }>
              <ClassRow gymClass={gymClass} />
            </Pressable>
          ))
        }
      </QueryState>
    </Screen>
  );
}
