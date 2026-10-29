import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SubscriptionCard } from '@/features/subscription/components/subscription-card';
import { usePaySubscription, useSubscriptionPayment } from '@/features/subscription/hooks';
import { canPay, isPending, nextPeriod, subscriptionStatus } from '@/features/subscription/rules';
import type { Subscription, SubscriptionPayment } from '@/features/subscription/types';
import { formatAmount, formatDate } from '@/lib/format';

/** The branch's plan with a Pay button while it's due, and the payment's status once made. */
export function PlanAndPay({
  gymId,
  gymName,
  sub,
}: {
  gymId: string;
  gymName: string;
  sub: Subscription;
}) {
  const pay = usePaySubscription(gymId);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const started = useSubscriptionPayment(paymentId);
  const period = nextPeriod(sub);
  const status = subscriptionStatus(sub);

  return (
    <>
      <SubscriptionCard sub={sub} title={`CoreFit Gym · ${gymName}`} />
      {status === 'unpaid' || status === 'expired' ? (
        <ThemedText type="small" themeColor="danger">
          Invites and member imports are off until you pay.
        </ThemedText>
      ) : null}
      {started.data ? <PaymentStatus payment={started.data} /> : null}
      {canPay(sub) && started.data?.status !== 'paid' ? (
        <View style={styles.pay}>
          <Button
            label={`Pay ${formatAmount(sub.amountCents, sub.currency)}`}
            icon="card-outline"
            loading={pay.isPending}
            onPress={() => pay.mutate(undefined, { onSuccess: setPaymentId })}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Covers {formatDate(period.start)} – {formatDate(period.end)}
          </ThemedText>
          {pay.error ? (
            <ThemedText type="small" themeColor="danger">
              {pay.error.message}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

function PaymentStatus({ payment }: { payment: SubscriptionPayment }) {
  const paid = payment.status === 'paid';
  const pending = isPending(payment);
  return (
    <Card style={styles.status}>
      {paid ? (
        <Icon name="checkmark-circle" size={24} color="success" />
      ) : pending ? (
        <ActivityIndicator />
      ) : (
        <Icon name="close-circle-outline" size={24} color="textSecondary" />
      )}
      <ThemedText type="small" style={styles.statusText}>
        {paid
          ? `Paid. Thank you! Now paid until ${formatDate(payment.periodEnd!)}.`
          : pending
            ? 'Waiting for Razorpay to confirm…'
            : 'Payment not completed. Try again.'}
      </ThemedText>
    </Card>
  );
}

const styles = StyleSheet.create({
  pay: {
    gap: Spacing.two,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  statusText: {
    flex: 1,
  },
});
