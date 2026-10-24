import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import type { MembershipPlan } from '@/features/memberships/types';
import { formatPrice } from '@/lib/format';

export function PlanCard({ plan, current }: { plan: MembershipPlan; current?: boolean }) {
  return (
    <Card highlighted={current} style={styles.card}>
      <View style={styles.body}>
        <ThemedText type="heading">{plan.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {plan.durationDays} days{current ? ' · your plan' : ''}
        </ThemedText>
      </View>
      <ThemedText type="heading" themeColor="primary">
        {formatPrice(plan.priceCents, plan.currency)}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
});
