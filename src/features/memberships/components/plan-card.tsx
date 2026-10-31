import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { LOYALTY_LABEL, priceFor, type OfferPrice } from '@/features/memberships/offers';
import { spellDate } from '@/features/memberships/rules';
import type { MembershipPlan } from '@/features/memberships/types';
import { formatAmount, formatPrice } from '@/lib/format';

export function PlanCard({
  plan,
  current,
  price = priceFor(plan),
  action,
}: {
  plan: MembershipPlan;
  current?: boolean;
  /** The member's price; defaults to the plan's offer, if any. */
  price?: OfferPrice;
  /** Shown under the plan, such as a Pay button. */
  action?: ReactNode;
}) {
  const onOffer = price.offer !== null;
  const until =
    onOffer && price.offer !== LOYALTY_LABEL && plan.offer
      ? ` till ${spellDate(plan.offer.endsOn)}`
      : '';
  return (
    <Card highlighted={current} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.body}>
          <ThemedText type="heading">{plan.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {plan.durationDays} days{current ? ' · your plan' : ''}
          </ThemedText>
        </View>
        <View style={styles.prices}>
          {onOffer ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.struck}>
              {formatAmount(price.originalCents, plan.currency)}
            </ThemedText>
          ) : null}
          <ThemedText type="heading" themeColor="accent">
            {onOffer
              ? formatAmount(price.priceCents, plan.currency)
              : formatPrice(plan.priceCents, plan.currency)}
          </ThemedText>
        </View>
      </View>
      {onOffer ? (
        <View style={styles.offer}>
          <Icon name="pricetag" size={14} color="accent" />
          <ThemedText type="smallBold" themeColor="accent" style={styles.flex}>
            {`${price.offer} · ${price.savings}${until}`}
          </ThemedText>
        </View>
      ) : null}
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
  prices: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  flex: {
    flex: 1,
  },
});
