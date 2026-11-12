import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ShareHistorySwitch } from '@/features/gym-invites/components/share-history-switch';
import { useAnswerGymInvite, useMyGymInvites } from '@/features/gym-invites/hooks';
import { inviteLine, leaveWarning } from '@/features/gym-invites/rules';
import type { GymInvite } from '@/features/gym-invites/types';

/**
 * Gyms that invited someone who already has an account. Nothing shows when there are
 * none, so it can sit on the inbox, Account and the no-gym screen.
 */
export function GymInvitesCard() {
  const invites = useMyGymInvites();
  if (!invites.data?.length) return null;
  return (
    <>
      {invites.data.map((invite) => (
        <InviteCard key={invite.id} invite={invite} />
      ))}
    </>
  );
}

function InviteCard({ invite }: { invite: GymInvite }) {
  const [share, setShare] = useState(false);
  // Joining moves them out of their other gyms, so that asks once more first.
  const [confirming, setConfirming] = useState(false);
  const answer = useAnswerGymInvite();
  const busy = answer.isPending;
  const warning = leaveWarning(invite);
  const join = () => answer.mutate({ inviteId: invite.id, join: true, shareHistory: share });
  return (
    <Card highlighted>
      <ThemedText type="heading">{invite.gymName}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {inviteLine(invite)}
      </ThemedText>
      <ShareHistorySwitch value={share} onChange={setShare} disabled={busy} />
      {confirming && warning ? (
        <ThemedText type="smallBold" themeColor="danger">
          {warning} Join anyway?
        </ThemedText>
      ) : null}
      {answer.error ? <ThemedText themeColor="danger">{answer.error.message}</ThemedText> : null}
      <View style={styles.buttons}>
        <View style={styles.flex}>
          <Button
            label={confirming ? 'Cancel' : 'Decline'}
            variant="secondary"
            disabled={busy}
            loading={busy && answer.variables?.join === false}
            onPress={() =>
              confirming
                ? setConfirming(false)
                : answer.mutate({ inviteId: invite.id, join: false })
            }
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={confirming ? 'Join anyway' : 'Join'}
            icon="checkmark"
            disabled={busy}
            loading={busy && answer.variables?.join === true}
            onPress={() => (warning && !confirming ? setConfirming(true) : join())}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  buttons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
