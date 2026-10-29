import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Pill, type PillTone } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  daysLeft,
  subscriptionStatus,
  type SubscriptionStatus,
} from '@/features/subscription/rules';
import type { Subscription } from '@/features/subscription/types';
import { formatAmount, formatDate } from '@/lib/format';

const pill: Record<SubscriptionStatus, { label: string; tone: PillTone }> = {
  active: { label: 'Active', tone: 'success' },
  dueSoon: { label: 'Renew soon', tone: 'warning' },
  expired: { label: 'Ended', tone: 'danger' },
  unpaid: { label: 'Not paid', tone: 'warning' },
  free: { label: 'Free', tone: 'accent' },
};

/** One line on how long the plan runs. */
export function subscriptionLine(sub: Subscription) {
  const status = subscriptionStatus(sub);
  const left = daysLeft(sub);
  switch (status) {
    case 'active':
      return `Paid until ${formatDate(sub.paidUntil!)}`;
    case 'dueSoon':
      return left === 0
        ? 'Ends today'
        : `Ends ${formatDate(sub.paidUntil!)} · ${left} day${left === 1 ? '' : 's'} left`;
    case 'expired':
      return `Ended ${formatDate(sub.paidUntil!)}`;
    case 'unpaid':
      return 'Not paid yet';
    case 'free':
      return 'Free for this branch';
  }
}

/** The branch's CoreFit Gym plan: price per year, status and the add-on when there is one. */
export function SubscriptionCard({ sub, title }: { sub: Subscription; title: string }) {
  const status = subscriptionStatus(sub);
  const money = (cents: number) => formatAmount(cents, sub.currency);

  return (
    <Card highlighted={status !== 'active' && status !== 'free'} style={styles.card}>
      <View style={styles.top}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.title}>
          {title}
        </ThemedText>
        <Pill label={pill[status].label} tone={pill[status].tone} />
      </View>
      <ThemedText type="title" themeColor="accent">
        {money(sub.amountCents)}
        <ThemedText themeColor="textSecondary"> / year</ThemedText>
      </ThemedText>
      <ThemedText type="smallBold">{subscriptionLine(sub)}</ThemedText>
      {sub.addonCents > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Branch {money(sub.feeCents)} + online payments {money(sub.addonCents)}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flexShrink: 1,
  },
});
