import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Pill, type PillTone } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { paymentState, type PaymentState } from '@/features/payments/rules';
import type { OnlinePayment } from '@/features/payments/types';
import { formatAmount, formatDateTime } from '@/lib/format';

export const paymentPill: Record<PaymentState, { label: string; tone: PillTone }> = {
  paid: { label: 'Paid', tone: 'success' },
  pending: { label: 'Paying now', tone: 'warning' },
  notCompleted: { label: 'Not completed', tone: 'neutral' },
};

/** One online payment in a list; opens its receipt or status. */
export function PaymentRow({
  payment,
  showMember,
}: {
  payment: OnlinePayment;
  /** Staff lists name the member; a member's own list doesn't. */
  showMember?: boolean;
}) {
  const state = paymentState(payment);
  const pill = paymentPill[state];
  const title = showMember ? payment.memberName : payment.planName;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${formatAmount(payment.amountCents, payment.currency)}, ${pill.label}`}
      onPress={() =>
        router.push({ pathname: '/payment/[paymentId]', params: { paymentId: payment.id } })
      }>
      <Card style={styles.row}>
        <View style={styles.body}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {showMember ? `${payment.planName} · ` : ''}
            {formatDateTime(payment.paidAt ?? payment.createdAt)}
          </ThemedText>
          <View style={styles.pills}>
            <Pill label={pill.label} tone={pill.tone} />
            {showMember && payment.transferError ? (
              <Pill label="Transfer failed" tone="danger" />
            ) : null}
          </View>
        </View>
        <ThemedText type="smallBold">
          {formatAmount(payment.amountCents, payment.currency)}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  body: {
    flex: 1,
    gap: Spacing.one,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
