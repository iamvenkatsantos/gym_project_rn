import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PaymentRow } from '@/features/payments/components/payment-row';
import { methodLabel, type HistoryEntry } from '@/features/payments/history';
import { formatAmount, formatDate } from '@/lib/format';

/** A member's payments, newest first. In-app ones open their receipt. */
export function PaymentHistoryList({ entries }: { entries: HistoryEntry[] }) {
  return entries.map((entry) =>
    entry.kind === 'pending' ? (
      <PaymentRow key={entry.id} payment={entry.payment} />
    ) : (
      <RecordedPayment key={entry.id} entry={entry} />
    ),
  );
}

function RecordedPayment({ entry }: { entry: Extract<HistoryEntry, { kind: 'recorded' }> }) {
  const { membership, onlinePaymentId } = entry;
  const amount =
    membership.amountPaidCents === null
      ? null
      : formatAmount(membership.amountPaidCents, membership.plan.currency);
  const method = membership.paymentMethod ? methodLabel[membership.paymentMethod] : null;
  const paid = formatDate(entry.paidAt);

  const body = (
    <Card style={styles.card}>
      <View style={styles.top}>
        <ThemedText type="smallBold" style={styles.flex}>
          {membership.plan.name}
        </ThemedText>
        {amount ? <ThemedText type="smallBold">{amount}</ThemedText> : null}
        {onlinePaymentId ? <Icon name="chevron-forward" size={16} /> : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {formatDate(membership.startsOn)} – {formatDate(membership.endsOn)}
      </ThemedText>
      <View style={styles.meta}>
        <ThemedText type="small" themeColor="textSecondary">
          Paid {paid}
          {amount ? '' : ' · amount not recorded'}
        </ThemedText>
        {method ? (
          <Pill
            label={method}
            tone={membership.paymentMethod === 'online' ? 'accent' : 'neutral'}
          />
        ) : null}
      </View>
    </Card>
  );

  if (!onlinePaymentId) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${membership.plan.name}, ${amount ?? ''}, paid ${paid}. Open receipt`}
      onPress={() =>
        router.push({ pathname: '/payment/[paymentId]', params: { paymentId: onlinePaymentId } })
      }>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
