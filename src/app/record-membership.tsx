import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { PersonRow } from '@/features/members/components/person-row';
import { usePeople } from '@/features/members/hooks';
import { PlanCard } from '@/features/memberships/components/plan-card';
import { useMemberships, usePlans, useRecordMembership } from '@/features/memberships/hooks';
import {
  addDays,
  endDateFor,
  latestByMember,
  parseRupees,
  renewalStart,
  toIsoDate,
} from '@/features/memberships/rules';
import type { MembershipPlan, PaymentMethod } from '@/features/memberships/types';
import { formatDate, formatPrice } from '@/lib/format';

const methods: { value: PaymentMethod; label: string }[] = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'complimentary', label: 'Complimentary' },
];

export default function RecordMembershipScreen() {
  const params = useLocalSearchParams<{ memberId?: string }>();
  const gym = useActiveGym();
  const people = usePeople(gym.gymId);
  const plans = usePlans(gym.gymId);
  const memberships = useMemberships(gym.gymId);
  const record = useRecordMembership(gym.gymId);

  const [memberId, setMemberId] = useState(params.memberId ?? null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<MembershipPlan | null>(null);
  const [startOverride, setStartOverride] = useState<string | null>(null);
  const [amountText, setAmount] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [note, setNote] = useState('');

  const member = people.data?.find((p) => p.id === memberId);
  const current = useMemo(
    () => (memberId && memberships.data ? latestByMember(memberships.data).get(memberId) : null),
    [memberId, memberships.data],
  );
  // A renewal starts on the member's current plan while it is still for sale.
  const plan = picked ?? plans.data?.find((p) => p.id === current?.plan.id) ?? null;
  const amount = amountText ?? (plan ? String(plan.priceCents / 100) : '');
  const today = toIsoDate(new Date());
  const startsOn = startOverride ?? renewalStart(current);
  const endsOn = plan ? endDateFor(startsOn, plan.durationDays) : null;
  const amountCents = method === 'complimentary' ? 0 : parseRupees(amount);
  const offset = Math.round(
    (new Date(`${startsOn}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) /
      86400000,
  );

  const pickPlan = (next: MembershipPlan) => {
    setPicked(next);
    setAmount(null);
  };

  if (!member) {
    const q = query.trim().toLowerCase();
    return (
      <Screen>
        <ThemedText type="small" themeColor="textSecondary">
          Who is paying? Invite new people from the People tab first.
        </ThemedText>
        <TextField
          label="Find a member"
          placeholder="Name or email"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <QueryState query={people}>
          {(list) => {
            const matches = list.filter(
              (p) =>
                p.role === 'member' &&
                (!q || p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
            );
            return matches.length === 0 ? (
              <ThemedText themeColor="textSecondary">No members match.</ThemedText>
            ) : (
              <Card>
                {matches.map((p, i) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    divider={i > 0}
                    onPress={() => setMemberId(p.id)}
                  />
                ))}
              </Card>
            );
          }}
        </QueryState>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="heading">{member.fullName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {current
                ? `${current.plan.name} until ${formatDate(current.endsOn)}`
                : 'No membership yet'}
            </ThemedText>
          </View>
          {params.memberId ? null : (
            <Button
              label="Change"
              variant="secondary"
              size="compact"
              onPress={() => {
                setMemberId(null);
                setPicked(null);
                setAmount(null);
                setStartOverride(null);
              }}
            />
          )}
        </View>
      </Card>

      <SectionHeader title="Plan" />
      <QueryState
        query={plans}
        isEmpty={(list) => list.length === 0}
        emptyText="Create a membership plan first, from the Memberships tab.">
        {(list) =>
          list.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: plan?.id === p.id }}
              accessibilityLabel={`${p.name}, ${formatPrice(p.priceCents, p.currency)}`}
              onPress={() => pickPlan(p)}>
              <PlanCard plan={p} current={plan?.id === p.id} />
            </Pressable>
          ))
        }
      </QueryState>

      <SectionHeader title="Dates" />
      <Stepper
        label="Start date"
        value={offset}
        min={-30}
        max={365}
        format={(days) => `Starts ${formatDate(addDays(today, days))}`}
        onChange={(days) => setStartOverride(addDays(today, days))}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {endsOn ? `Ends ${formatDate(endsOn)}. ` : ''}
        {current && !startOverride && startsOn !== today
          ? 'Starts the day after their current membership ends, so they lose no days.'
          : ''}
      </ThemedText>

      <SectionHeader title="Payment" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}>
        {methods.map((m) => (
          <Chip
            key={m.value}
            label={m.label}
            selected={method === m.value}
            onPress={() => setMethod(m.value)}
          />
        ))}
      </ScrollView>
      {method === 'complimentary' ? null : (
        <TextField
          label="Amount received (₹)"
          placeholder="1499"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
      )}
      <TextField
        label="Note (optional)"
        placeholder="e.g. UPI ref 4512, or 10% student discount"
        value={note}
        onChangeText={setNote}
        maxLength={200}
      />

      {record.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {record.error.message}</ThemedText>
      ) : null}
      <Button
        label={
          plan && amountCents !== null
            ? `Record ${formatPrice(amountCents, plan.currency)} payment`
            : 'Record payment'
        }
        icon="receipt-outline"
        disabled={!plan || !endsOn || amountCents === null}
        loading={record.isPending}
        onPress={() =>
          plan &&
          endsOn &&
          amountCents !== null &&
          record.mutate(
            {
              memberId: member.id,
              planId: plan.id,
              startsOn,
              endsOn,
              amountPaidCents: amountCents,
              paymentMethod: method,
              note,
            },
            { onSuccess: () => router.back() },
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  chips: {
    gap: Spacing.two,
  },
});
