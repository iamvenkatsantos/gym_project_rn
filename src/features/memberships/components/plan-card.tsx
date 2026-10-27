import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { MembershipPlan } from '@/features/memberships/types';
import { formatPrice } from '@/lib/format';

export function PlanCard({
  plan,
  current,
  action,
}: {
  plan: MembershipPlan;
  current?: boolean;
  /** Shown under the plan, such as a Pay button. */
  action?: ReactNode;
}) {
  return (
    <Card highlighted={current} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.body}>
          <ThemedText type="heading">{plan.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {plan.durationDays} days{current ? ' · your plan' : ''}
          </ThemedText>
        </View>
        <ThemedText type="heading" themeColor="accent">
          {formatPrice(plan.priceCents, plan.currency)}
        </ThemedText>
      </View>
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  body: {
    flex: 1,
    minWidth: 140,
  },
});
