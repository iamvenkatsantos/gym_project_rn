import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ShareHistorySwitch } from '@/features/gym-invites/components/share-history-switch';
import { useHistorySharing, useSetHistorySharing } from '@/features/gym-invites/hooks';

/** The member's Share my history switch for the gym that's open, saved on tap. */
export function HistorySharing({ gymId, userId }: { gymId: string; userId: string }) {
  const sharing = useHistorySharing(gymId, userId);
  const save = useSetHistorySharing(gymId, userId);
  const value = save.isPending ? save.variables : sharing.data === true;
  return (
    <Card>
      <ShareHistorySwitch
        value={value}
        onChange={(next) => save.mutate(next)}
        disabled={sharing.isLoading || save.isPending}
      />
      {save.error ? <ThemedText themeColor="danger">{save.error.message}</ThemedText> : null}
    </Card>
  );
}
