import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { membershipStatus } from '@/features/memberships/rules';
import type { Membership } from '@/features/memberships/types';
import { useOnlinePaymentsEnabled, usePayOnline } from '@/features/payments/hooks';
import { formatAmount } from '@/lib/format';

/**
 * A member's Renew now button under their membership, once it's ending or has
 * ended and the branch takes online payments. Renews the same plan at today's price.
 */
export function RenewOnline({ gymId, membership }: { gymId: string; membership: Membership }) {
  const enabled = useOnlinePaymentsEnabled(gymId);
  const pay = usePayOnline(gymId);
  const status = membershipStatus(membership);
  if (!enabled.data || (status !== 'expiringSoon' && status !== 'expired')) return null;

  return (
    <View style={styles.wrap}>
      <Button
        label={`Renew now · ${formatAmount(membership.plan.priceCents, membership.plan.currency)}`}
        icon="card-outline"
        loading={pay.isPending}
        onPress={() => pay.mutate(membership.plan.id)}
      />
      {pay.error ? (
        <ThemedText type="small" themeColor="danger">
          {pay.error.message}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
});
