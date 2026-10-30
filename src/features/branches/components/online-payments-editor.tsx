import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSetOnlineFeesOnMember, useSetOnlinePayments } from '@/features/branches/hooks';
import { onlinePaymentExample } from '@/features/branches/rules';
import type { AdminBranch, BillingSettings } from '@/features/branches/types';
import { formatAmount } from '@/lib/format';

const ACCOUNT_PATTERN = /^acc_[A-Za-z0-9]{6,32}$/;

/**
 * Admins only: online payments for one branch, free unless an add-on price is set. Members' payments go
 * to the owner's Razorpay linked account (Route), never to CoreFit Gym.
 */
export function OnlinePaymentsEditor({
  branch,
  billing,
}: {
  branch: AdminBranch;
  billing: BillingSettings;
}) {
  const save = useSetOnlinePayments(branch.gymId);
  const fees = useSetOnlineFeesOnMember(branch.gymId);
  const [account, setAccount] = useState(branch.razorpayAccountId ?? '');
  const trimmed = account.trim();
  const invalid =
    trimmed && !ACCOUNT_PATTERN.test(trimmed)
      ? 'Use the linked account ID from Razorpay → Route, like acc_XXXXXXXXXXXXXX'
      : null;
  const accountChanged = trimmed !== (branch.razorpayAccountId ?? '');
  const addon = formatAmount(billing.onlineAddonCents, billing.currency);
  const hasAddon = billing.onlineAddonCents > 0;
  const example = onlinePaymentExample(branch.feesOnMember, billing.onlineCutBps);
  const money = (cents: number) => formatAmount(cents, billing.currency);

  return (
    <Card style={styles.card}>
      <View style={styles.status}>
        <Pill
          label={branch.onlinePayments ? 'On' : 'Off'}
          tone={branch.onlinePayments ? 'success' : 'neutral'}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {branch.onlinePayments
            ? `Members pay in the app.${hasAddon ? ` Adds ${addon} to this branch's yearly bill.` : ''}`
            : `Members pay at the front desk.${hasAddon ? ` Switching on adds ${addon} a year.` : ''}`}
        </ThemedText>
      </View>
      <TextField
        label="Owner's Razorpay linked account"
        icon="wallet-outline"
        value={account}
        onChangeText={setAccount}
        error={invalid}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="acc_XXXXXXXXXXXXXX"
      />
      <ThemedText type="small" themeColor="textSecondary">
        {trimmed
          ? branch.feesOnMember
            ? 'Payments go straight to this account, in full.'
            : 'Payments go straight to this account, less Razorpay’s fees.'
          : 'Without one, test payments stay in your Razorpay account. Live payments need it.'}
      </ThemedText>
      {accountChanged ? (
        <Button
          label="Save account"
          variant="secondary"
          size="compact"
          disabled={!!invalid}
          loading={save.isPending}
          onPress={() => save.mutate({ enabled: branch.onlinePayments, accountId: trimmed })}
        />
      ) : null}
      <Button
        label={branch.onlinePayments ? 'Switch off online payments' : 'Switch on online payments'}
        icon={branch.onlinePayments ? 'close-circle-outline' : 'card-outline'}
        variant={branch.onlinePayments ? 'danger' : 'primary'}
        size="compact"
        disabled={!!invalid}
        loading={save.isPending}
        onPress={() => save.mutate({ enabled: !branch.onlinePayments, accountId: trimmed })}
      />
      {save.error ? <ThemedText themeColor="danger">{save.error.message}</ThemedText> : null}
      <View style={styles.status}>
        <Pill label={branch.feesOnMember ? 'Member pays fees' : 'Owner pays fees'} tone="neutral" />
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {branch.feesOnMember
            ? `Razorpay’s fees (about 2.7%) are added to the price: a ${money(100000)} plan costs the member ${money(example.memberPaysCents)} and the owner gets ${money(example.ownerGetsCents)}.`
            : `Members pay the price; Razorpay’s fees (about 2.7%) come out of what the owner gets: ${money(example.ownerGetsCents)} from a ${money(100000)} plan.`}
        </ThemedText>
      </View>
      <Button
        label={branch.feesOnMember ? 'Owner pays the fees instead' : 'Member pays the fees instead'}
        icon="swap-horizontal-outline"
        variant="secondary"
        size="compact"
        loading={fees.isPending}
        onPress={() => fees.mutate(!branch.feesOnMember)}
      />
      {fees.error ? <ThemedText themeColor="danger">{fees.error.message}</ThemedText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
