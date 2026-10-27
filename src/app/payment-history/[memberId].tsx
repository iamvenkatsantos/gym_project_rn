import { router, Stack, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { useActiveGym } from '@/features/auth/use-profile';
import { MemberPaymentHistory } from '@/features/payments/components/member-payment-history';

/** Owners and supervisors: every payment one member has made. */
export default function MemberPaymentHistoryScreen() {
  const { memberId, name } = useLocalSearchParams<{ memberId: string; name?: string }>();
  const gym = useActiveGym();

  return (
    <Screen>
      {name ? <Stack.Screen options={{ title: name }} /> : null}
      <Button
        label="Record a payment"
        icon="receipt-outline"
        variant="secondary"
        onPress={() => router.push({ pathname: '/record-membership', params: { memberId } })}
      />
      <MemberPaymentHistory
        gymId={gym.gymId}
        memberId={memberId}
        emptyText="No payments from this member yet."
      />
    </Screen>
  );
}
