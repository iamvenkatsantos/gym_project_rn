import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMemberPrice, usePlans } from '@/features/memberships/hooks';
import { membershipStatus } from '@/features/memberships/rules';
import type { Membership } from '@/features/memberships/types';
import { useOnlinePaymentsEnabled, usePayOnline } from '@/features/payments/hooks';
import { formatAmount } from '@/lib/format';

/**
 * A member's Renew now button under their membership, once it's ending or has
 * ended and the branch takes online payments. Renews the same plan at today's
 * price (with any offer), so it's hidden when that plan is free or no longer on sale.
 */
export function RenewOnline({ gymId, membership }: { gymId: string; membership: Membership }) {
  const enabled = useOnlinePaymentsEnabled(gymId);
  const plans = usePlans(gymId);
  const pay = usePayOnline(gymId);
  const priceOf = useMemberPrice(gymId, membership.memberId);
  const status = membershipStatus(membership);
  const plan = plans.data?.find((p) => p.id === membership.plan.id);
  if (!enabled.data || !plan) return null;
  if (status !== 'expiringSoon' && status !== 'expired') return null;
  const price = priceOf(plan);
  if (price.priceCents < 100) return null;

  return (
    <View style={styles.wrap}>
      <Button
        label={`Renew now · ${formatAmount(price.priceCents, plan.currency)}`}
        icon="card-outline"
        loading={pay.isPending}
        onPress={() => pay.mutate(plan.id)}
      />
      {price.offer ? (
        <ThemedText type="small" themeColor="accent">
          {price.offer} · {price.savings}
        </ThemedText>
      ) : null}
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
