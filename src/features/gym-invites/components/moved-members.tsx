import { ListGroup, ListRow } from '@/components/list-row';
import { SectionHeader } from '@/components/section-header';
import { useMovedMembers } from '@/features/gym-invites/hooks';
import { movedLine } from '@/features/gym-invites/rules';

/** People who left this gym by joining another. Hidden when there are none. */
export function MovedMembers({ gymId }: { gymId: string }) {
  const moved = useMovedMembers(gymId);
  if (!moved.data?.length) return null;
  return (
    <>
      <SectionHeader title={`Moved out ${moved.data.length}`} />
      <ListGroup>
        {moved.data.map((m, i) => (
          <ListRow
            key={m.userId}
            icon="exit-outline"
            label={m.fullName}
            detail={movedLine(m)}
            divider={i > 0}
          />
        ))}
      </ListGroup>
    </>
  );
}
