import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { useArchivePlan, usePlans, useSavePlan } from '@/features/memberships/hooks';
import { PlanCard } from '@/features/memberships/components/plan-card';
import { offerActive, offerAnnouncement, offerProblem } from '@/features/memberships/offers';
import { addDays, toIsoDate } from '@/features/memberships/rules';
import type { MembershipPlan, PlanOffer } from '@/features/memberships/types';
import { formatDate } from '@/lib/format';
import { firstError, parseAmount, validateAmount, validateTitle } from '@/lib/validation';

type OfferKind = 'none' | PlanOffer['type'];

const offerKinds: { value: OfferKind; label: string }[] = [
  { value: 'none', label: 'No offer' },
  { value: 'percent', label: '% off' },
  { value: 'flat', label: '₹ off' },
];

function daysUntil(isoDate: string, today: string) {
  const ms = new Date(`${isoDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime();
  return Math.round(ms / 86400000);
}

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
      <Screen refreshable={false}>
        <ThemedText themeColor="textSecondary">
          {plans.isPending ? 'Loading…' : 'Plan not found.'}
        </ThemedText>
      </Screen>
    );
  }
  return <PlanForm key={plan?.id ?? 'new'} gymId={gym.gymId} gymName={gym.gymName} plan={plan} />;
}

function PlanForm({
  gymId,
  gymName,
  plan,
}: {
  gymId: string;
  gymName: string;
  plan?: MembershipPlan;
}) {
  const today = toIsoDate(new Date());
  const saved = plan?.offer ?? null;
  // An offer that has ended starts over as no offer.
  const savedLive = saved && saved.endsOn >= today ? saved : null;
  const [name, setName] = useState(plan?.name ?? '');
  const [price, setPrice] = useState(plan ? String(plan.priceCents / 100) : '');
  const [durationDays, setDurationDays] = useState(plan?.durationDays ?? 30);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [offerKind, setOfferKind] = useState<OfferKind>(savedLive?.type ?? 'none');
  const [offerText, setOfferText] = useState(
    savedLive ? String(savedLive.type === 'flat' ? savedLive.value / 100 : savedLive.value) : '',
  );
  const [offerLabelText, setOfferLabel] = useState(savedLive?.label ?? '');
  const [offerDays, setOfferDays] = useState(savedLive ? daysUntil(savedLive.endsOn, today) : 7);
  const save = useSavePlan(gymId);
  const archive = useArchivePlan();
  const nameError = validateTitle(name, { label: 'plan name', max: 40 });
  const priceError = validateAmount(price, { label: 'price' });
  const priceCents = priceError ? null : parseAmount(price);
  const offerValue =
    offerKind === 'flat' ? (parseAmount(offerText) ?? 0) : Number(offerText.trim()) || 0;
  const offer: PlanOffer | null =
    offerKind === 'none'
      ? null
      : {
          type: offerKind,
          value: offerValue,
          label: offerLabelText,
          // Keep when a running offer started; a new one starts today.
          startsOn: savedLive?.type === offerKind ? (savedLive.startsOn ?? null) : today,
          endsOn: addDays(today, offerDays),
        };
  const offerError = offer ? offerProblem(offer, priceCents) : null;
  const problem = firstError(nameError, priceError, offerError);
  const preview: MembershipPlan | null =
    priceCents !== null && name.trim()
      ? {
          id: plan?.id ?? 'new',
          name: name.trim(),
          priceCents,
          currency: plan?.currency ?? 'INR',
          durationDays,
          offer: offer && !offerError ? offer : null,
        }
      : null;
  const announce = plan && saved && offerActive(plan) ? offerAnnouncement(plan, gymName) : null;

  return (
    <Screen refreshable={false}>
      <Stack.Screen options={{ title: plan ? 'Edit plan' : 'New membership plan' }} />
      <TextField
        label="Plan name"
        placeholder="e.g. Monthly, Quarterly, Annual"
        value={name}
        onChangeText={setName}
        maxLength={40}
        error={nameError}
      />
      <TextField
        label="Price (₹)"
        placeholder="1499"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        maxLength={12}
        error={priceError}
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

      <SectionHeader title="Offer" />
      <SegmentedControl options={offerKinds} value={offerKind} onChange={setOfferKind} />
      {offerKind === 'none' ? null : (
        <>
          <TextField
            label={offerKind === 'percent' ? 'Discount (%)' : 'Amount off (₹)'}
            placeholder={offerKind === 'percent' ? '10' : '200'}
            value={offerText}
            onChangeText={setOfferText}
            keyboardType={offerKind === 'percent' ? 'number-pad' : 'decimal-pad'}
            maxLength={offerKind === 'percent' ? 2 : 12}
            error={offerText ? offerError : null}
          />
          <TextField
            label="Offer name (optional)"
            placeholder="e.g. Diwali offer"
            value={offerLabelText}
            onChangeText={setOfferLabel}
            maxLength={30}
          />
          <Stepper
            label="Offer ends"
            value={offerDays}
            min={0}
            max={365}
            format={(days) => `Till ${formatDate(addDays(today, days))}`}
            onChange={setOfferDays}
          />
        </>
      )}

      {preview ? (
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Members will see
          </ThemedText>
          <PlanCard plan={preview} />
        </View>
      ) : null}

      {save.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {save.error.message}</ThemedText>
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
              input: { name, priceCents: priceCents ?? 0, durationDays, offer },
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
      {announce ? (
        <Button
          label="Announce this offer"
          icon="megaphone-outline"
          variant="secondary"
          size="compact"
          onPress={() =>
            router.push({
              pathname: '/new-announcement',
              params: { title: announce.title, body: announce.body, audience: 'members' },
            })
          }
        />
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
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
