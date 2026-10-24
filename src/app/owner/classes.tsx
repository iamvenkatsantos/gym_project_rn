import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ClassCard } from '@/features/bookings/components/class-card';
import { useUpcomingClasses } from '@/features/bookings/hooks';

export default function OwnerClassesScreen() {
  const classes = useUpcomingClasses();

  return (
    <Screen>
      <QueryState query={classes} isEmpty={(c) => c.length === 0} emptyText="No classes scheduled.">
        {(list) => list.map((gymClass) => <ClassCard key={gymClass.id} gymClass={gymClass} />)}
      </QueryState>
    </Screen>
  );
}
