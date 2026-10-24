import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { useArchivePlan, usePlans, useSavePlan } from '@/features/memberships/hooks';
import { parseRupees } from '@/features/memberships/rules';
import type { MembershipPlan } from '@/features/memberships/types';
import { formatPrice } from '@/lib/format';

const durations = [
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
];

export default function MembershipPlanEditorScreen() {
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const gym = useActiveGym();
  const plans = usePlans(gym.gymId);
  const plan = plans.data?.find((p) => p.id === planId);

  if (planId && !plan) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          {plans.isPending ? 'Loading…' : 'Plan not found.'}
        </ThemedText>
      </Screen>
    );
  }
  return <PlanForm key={plan?.id ?? 'new'} gymId={gym.gymId} plan={plan} />;
}

function PlanForm({ gymId, plan }: { gymId: string; plan?: MembershipPlan }) {
  const [name, setName] = useState(plan?.name ?? '');
  const [price, setPrice] = useState(plan ? String(plan.priceCents / 100) : '');
  const [durationDays, setDurationDays] = useState(plan?.durationDays ?? 30);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const save = useSavePlan(gymId);
  const archive = useArchivePlan();
  const priceCents = parseRupees(price);
  const problem = !name.trim()
    ? 'Give the plan a name.'
    : priceCents === null
      ? 'Enter the price in rupees, like 1499.'
      : null;

  return (
    <Screen>
      <Stack.Screen options={{ title: plan ? 'Edit plan' : 'New membership plan' }} />
      <TextField
        label="Plan name"
        placeholder="e.g. Monthly, Quarterly, Annual"
        value={name}
        onChangeText={setName}
        maxLength={40}
      />
      <TextField
        label="Price (₹)"
        placeholder="1499"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />
      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Length
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {durations.map((d) => (
            <Chip
              key={d.days}
              label={d.label}
              selected={durationDays === d.days}
              onPress={() => setDurationDays(d.days)}
            />
          ))}
        </ScrollView>
        <Stepper
          label="Length in days"
          value={durationDays}
          min={1}
          max={3660}
          format={(d) => `${d} ${d === 1 ? 'day' : 'days'}`}
          onChange={setDurationDays}
        />
      </View>

      {priceCents !== null && name.trim() ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Members will see
          </ThemedText>
          <View style={styles.preview}>
            <ThemedText type="heading" style={styles.flex}>
              {name.trim()}
            </ThemedText>
            <ThemedText type="heading" themeColor="primary">
              {formatPrice(priceCents, plan?.currency ?? 'INR')}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {durationDays} days
          </ThemedText>
        </Card>
      ) : null}

      {save.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {save.error.message}</ThemedText>
      ) : null}
      {problem && (name || price) ? (
        <ThemedText themeColor="textSecondary">{problem}</ThemedText>
      ) : null}
      <Button
        label={plan ? 'Save changes' : 'Create plan'}
        icon="checkmark"
        disabled={!!problem}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            {
              planId: plan?.id ?? null,
              input: { name, priceCents: priceCents ?? 0, durationDays },
            },
            { onSuccess: () => router.back() },
          )
        }
      />
      {plan ? (
        <ThemedText type="small" themeColor="textSecondary">
          Price changes apply to new sales. Members already on this plan keep what they paid.
        </ThemedText>
      ) : null}

      {plan ? (
        confirmArchive ? (
          <Card>
            <ThemedText type="smallBold">Stop selling {plan.name}?</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              It disappears from the plan list. Current memberships on it run until they end.
            </ThemedText>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  label="Keep it"
                  variant="secondary"
                  size="compact"
                  onPress={() => setConfirmArchive(false)}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Stop selling"
                  variant="danger"
                  size="compact"
                  loading={archive.isPending}
                  onPress={() => archive.mutate(plan.id, { onSuccess: () => router.back() })}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Button
            label="Stop selling this plan"
            variant="danger"
            size="compact"
            onPress={() => setConfirmArchive(true)}
          />
        )
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
