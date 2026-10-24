import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { useActiveGym } from '@/features/auth/use-profile';
import { ClassRow } from '@/features/bookings/components/class-row';
import { DateStrip } from '@/features/bookings/components/date-strip';
import { useUpcomingClasses } from '@/features/bookings/hooks';
import { classesOnDay, upcomingDays } from '@/features/bookings/rules';

export default function OwnerClassesScreen() {
  const gym = useActiveGym();
  const days = useMemo(() => upcomingDays(14), []);
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const classes = useUpcomingClasses(gym.gymId);

  return (
    <Screen>
      <Button label="Schedule a class" icon="add" onPress={() => router.push('/class-editor')} />
      <DateStrip days={days} selected={selectedDay} onSelect={setSelectedDay} />
      <QueryState
        query={classes}
        isEmpty={(list) => classesOnDay(list, selectedDay).length === 0}
        emptyText="No more classes this day.">
        {(list) =>
          classesOnDay(list, selectedDay).map((gymClass) => (
            <Pressable
              key={gymClass.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${gymClass.title}`}
              onPress={() =>
                router.push({ pathname: '/class-editor', params: { classId: gymClass.id } })
              }>
              <ClassRow gymClass={gymClass} />
            </Pressable>
          ))
        }
      </QueryState>
    </Screen>
  );
}
