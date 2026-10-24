import { useMemo, useState } from 'react';

import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ClassRow } from '@/features/bookings/components/class-row';
import { DateStrip } from '@/features/bookings/components/date-strip';
import { useUpcomingClasses } from '@/features/bookings/hooks';
import { classesOnDay, upcomingDays } from '@/features/bookings/rules';

export default function OwnerClassesScreen() {
  const days = useMemo(() => upcomingDays(7), []);
  const [selectedDay, setSelectedDay] = useState(days[0]);
  const classes = useUpcomingClasses();

  return (
    <Screen>
      <DateStrip days={days} selected={selectedDay} onSelect={setSelectedDay} />
      <QueryState
        query={classes}
        isEmpty={(list) => classesOnDay(list, selectedDay).length === 0}
        emptyText="No more classes this day.">
        {(list) =>
          classesOnDay(list, selectedDay).map((gymClass) => (
            <ClassRow key={gymClass.id} gymClass={gymClass} />
          ))
        }
      </QueryState>
    </Screen>
  );
}
