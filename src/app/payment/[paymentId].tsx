import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ListGroup, ListRow } from '@/components/list-row';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { paymentPill } from '@/features/payments/components/payment-row';
import { openPaymentPage, useOnlinePayment, usePayOnline } from '@/features/payments/hooks';
import { netAmount, paymentState } from '@/features/payments/rules';
import type { OnlinePayment } from '@/features/payments/types';
import { formatAmount, formatDate, formatDateTime } from '@/lib/format';

/** A payment's receipt once paid; until then its status, with a way to finish or retry. */
export default function PaymentScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const payment = useOnlinePayment(paymentId);

  return (
    <Screen>
      <QueryState query={payment} isEmpty={(p) => !p} emptyText="We couldn't find this payment.">
        {(p) => p && <PaymentDetails payment={p} />}
      </QueryState>
    </Screen>
  );
}

function PaymentDetails({ payment }: { payment: OnlinePayment }) {
  const profile = useProfile();
  const gym = useActiveGym();
  const pay = usePayOnline(gym.gymId);
  const state = paymentState(payment);
  const pill = paymentPill[state];
  const amount = formatAmount(payment.amountCents, payment.currency);
  const isMember = payment.memberId === profile.id;
  const net = netAmount(payment);

  return (
    <>
      <Card style={styles.hero}>
        {state === 'paid' ? (
          <Icon name="checkmark-circle" size={48} color="success" />
        ) : state === 'pending' ? (
          <ActivityIndicator />
        ) : (
          <Icon name="close-circle-outline" size={48} color="textSecondary" />
        )}
        <ThemedText type="title" style={styles.center}>
          {amount}
        </ThemedText>
        <Pill label={pill.label} tone={pill.tone} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {state === 'paid'
            ? `${payment.planName} membership${payment.endsOn ? ` until ${formatDate(payment.endsOn)}` : ''}.`
            : state === 'pending'
              ? 'Waiting for Razorpay to confirm. This usually takes a few seconds.'
              : 'This payment wasn’t completed. If money left your account, it’s refunded by your bank in 5–7 days.'}
        </ThemedText>
      </Card>

      <ListGroup>
        <ListRow icon="person-outline" label="Member" detail={payment.memberName} />
        <ListRow divider icon="pricetag-outline" label="Plan" detail={payment.planName} />
        {payment.startsOn && payment.endsOn ? (
          <ListRow
            divider
            icon="calendar-outline"
            label="Membership"
            detail={`${formatDate(payment.startsOn)} – ${formatDate(payment.endsOn)}`}
          />
        ) : null}
        <ListRow
          divider
          icon="time-outline"
          label={state === 'paid' ? 'Paid' : 'Started'}
          detail={formatDateTime(payment.paidAt ?? payment.createdAt)}
        />
        {payment.razorpayPaymentId ? (
          <ListRow
            divider
            icon="receipt-outline"
            label="Payment ID"
            detail={payment.razorpayPaymentId}
          />
        ) : null}
        {!isMember && net !== null ? (
          <ListRow
            divider
            icon="wallet-outline"
            label="Gym receives"
            detail={`${formatAmount(net, payment.currency)} after Razorpay's fee`}
          />
        ) : null}
      </ListGroup>

      {!isMember && payment.transferError ? (
        <Card>
          <ThemedText type="smallBold" themeColor="danger">
            The money didn&apos;t reach the gym&apos;s Razorpay account yet
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {payment.transferError}. CoreFit Gym will settle it; the membership is already active.
          </ThemedText>
        </Card>
      ) : null}

      {isMember && state === 'pending' && payment.linkUrl ? (
        <Button
          label="Continue paying"
          icon="card-outline"
          variant="secondary"
          onPress={() => openPaymentPage(payment.linkUrl!)}
        />
      ) : null}
      {isMember && state === 'notCompleted' ? (
        <>
          <Button
            label={`Try again · ${amount}`}
            icon="refresh-outline"
            loading={pay.isPending}
            onPress={() => pay.mutate(payment.planId)}
          />
          {pay.error ? (
            <ThemedText type="small" themeColor="danger">
              {pay.error.message}
            </ThemedText>
          ) : null}
        </>
      ) : null}
      {state === 'paid' ? (
        <View style={styles.done}>
          <Button
            label="Done"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  center: {
    textAlign: 'center',
  },
  done: {
    gap: Spacing.two,
  },
});
