import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentRef, useRef } from 'react';
import { type View } from 'react-native';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym } from '@/features/auth/use-profile';
import { ReceiptCard, ReceiptPage } from '@/features/payments/components/receipt-card';
import { useReceipt } from '@/features/payments/hooks';
import { receiptAddress, type Receipt } from '@/features/payments/receipt';
import { shareReceipt } from '@/features/payments/share-receipt';

/** A membership payment's receipt on its PDF page, shared as a PDF or an image. */
export default function ReceiptScreen() {
  const { membershipId } = useLocalSearchParams<{ membershipId: string }>();
  const receipt = useReceipt(membershipId);

  return (
    <Screen>
      <QueryState query={receipt} isEmpty={(r) => !r} emptyText="No receipt for this payment.">
        {(r) => r && <ReceiptView receipt={r} />}
      </QueryState>
    </Screen>
  );
}

function ReceiptView({ receipt }: { receipt: Receipt }) {
  const card = useRef<ComponentRef<typeof View>>(null);
  const share = useMutation({ mutationFn: shareReceipt });
  const gym = useActiveGym();
  const addAddress = gym.role === 'owner' && !receiptAddress(receipt);

  return (
    <>
      <ReceiptPage>
        <ReceiptCard ref={card} receipt={receipt} />
      </ReceiptPage>
      <Button
        label="Share PDF"
        icon="document-outline"
        loading={share.isPending && share.variables?.format === 'pdf'}
        disabled={share.isPending}
        onPress={() => share.mutate({ card, receipt, format: 'pdf' })}
      />
      <Button
        label="Share image"
        icon="image-outline"
        variant="secondary"
        loading={share.isPending && share.variables?.format === 'image'}
        disabled={share.isPending}
        onPress={() => share.mutate({ card, receipt, format: 'image' })}
      />
      {share.error ? (
        <ThemedText type="small" themeColor="danger">
          {share.error.message}
        </ThemedText>
      ) : null}
      {addAddress ? (
        <Button
          label="Add the gym's address"
          icon="location-outline"
          variant="secondary"
          onPress={() => router.push('/gym-details')}
        />
      ) : null}
    </>
  );
}
