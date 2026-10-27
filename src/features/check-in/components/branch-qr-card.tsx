import { useMutation } from '@tanstack/react-query';
import { type ComponentRef, useRef } from 'react';
import { Alert, type View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { QueryState } from '@/components/query-state';
import { ThemedText } from '@/components/themed-text';
import { BranchQrPoster, type PosterBranch } from '@/features/check-in/components/branch-qr-poster';
import { useAdminBranchQr, useResetAdminBranchQr } from '@/features/check-in/hooks';
import { shareBranchQr } from '@/features/check-in/share-qr';

/**
 * Admins: the branch's check-in QR card, sent to its owner as an image on
 * WhatsApp. Members and trainers scan the printout to check in and out.
 */
export function BranchQrCard({ branch }: { branch: PosterBranch }) {
  const qr = useAdminBranchQr(branch.gymId);
  const reset = useResetAdminBranchQr(branch.gymId);
  const share = useMutation({ mutationFn: shareBranchQr });
  const card = useRef<ComponentRef<typeof View>>(null);

  return (
    <Card>
      <QueryState query={qr}>
        {(data) => (
          <>
            <BranchQrPoster ref={card} branch={branch} posterCode={data.posterCode} />
            {data.posterEnabled ? null : (
              <ThemedText type="small" themeColor="danger">
                The owner switched the printed QR off, so it doesn&apos;t work. Resetting it makes a
                new one that works.
              </ThemedText>
            )}
            <Button
              label="Share QR"
              icon="logo-whatsapp"
              loading={share.isPending}
              onPress={() =>
                share.mutate({
                  card,
                  gymId: branch.gymId,
                  gymName: branch.gymName,
                  posterCode: data.posterCode,
                })
              }
            />
            <ThemedText type="small" themeColor="textSecondary">
              Sends this card as an image, like a UPI QR. The owner prints it for the front desk.
            </ThemedText>
            <Button
              label="Reset QR"
              icon="refresh"
              variant="secondary"
              loading={reset.isPending}
              onPress={() =>
                Alert.alert(
                  'Reset this branch’s QR?',
                  'The printed QR stops working. Send the owner the new one straight away.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Reset', style: 'destructive', onPress: () => reset.mutate() },
                  ],
                )
              }
            />
            {share.error || reset.error ? (
              <ThemedText type="small" themeColor="danger">
                {(share.error ?? reset.error)!.message}
              </ThemedText>
            ) : null}
          </>
        )}
      </QueryState>
    </Card>
  );
}
