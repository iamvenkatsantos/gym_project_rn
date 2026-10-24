import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { useProfile } from '@/features/auth/use-profile';
import { ClassRow } from '@/features/bookings/components/class-row';
import { useUpcomingClasses } from '@/features/bookings/hooks';

export default function TrainerScheduleScreen() {
  const profile = useProfile();
  const classes = useUpcomingClasses(profile.id);

  return (
    <Screen>
      <QueryState query={classes} isEmpty={(c) => c.length === 0} emptyText="No classes scheduled.">
        {(list) =>
          list.map((gymClass, i) => (
            <ClassRow key={gymClass.id} gymClass={gymClass} showDay highlighted={i === 0} />
          ))
        }
      </QueryState>
    </Screen>
  );
}
