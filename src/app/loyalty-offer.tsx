import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym } from '@/features/auth/use-profile';
import { useLoyaltyOffer, useMemberships, useSaveLoyaltyOffer } from '@/features/memberships/hooks';
import {
  DEFAULT_LOYALTY,
  MAX_LOYALTY_MONTHS,
  MAX_LOYALTY_PERCENT,
  earnsLoyalty,
} from '@/features/memberships/offers';
import { latestByMember, renewalStart } from '@/features/memberships/rules';
import type { LoyaltyOffer } from '@/features/memberships/types';

/** Owners: a discount on renewals for members who keep paying without a break. */
export default function LoyaltyOfferScreen() {
  const gym = useActiveGym();
  const loyalty = useLoyaltyOffer(gym.gymId);
  if (loyalty.isPending) {
    return (
      <Screen refreshable={false}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </Screen>
    );
  }
  return <LoyaltyForm gymId={gym.gymId} saved={loyalty.data ?? null} />;
}

function LoyaltyForm({ gymId, saved }: { gymId: string; saved: LoyaltyOffer | null }) {
  const [on, setOn] = useState(saved !== null);
  const [months, setMonths] = useState(saved?.months ?? DEFAULT_LOYALTY.months);
  const [percent, setPercent] = useState(saved?.percent ?? DEFAULT_LOYALTY.percent);
  const memberships = useMemberships(gymId).data;
  const save = useSaveLoyaltyOffer(gymId);

  const qualify = useMemo(() => {
    if (!memberships) return null;
    const offer = { months, percent };
    return [...latestByMember(memberships).values()].filter((m) =>
      earnsLoyalty(offer, memberships, m.memberId, renewalStart(m)),
    ).length;
  }, [memberships, months, percent]);

  return (
    <Screen refreshable={false}>
      <SegmentedControl
        options={[
          { value: 'off', label: 'Off' },
          { value: 'on', label: 'On' },
        ]}
        value={on ? 'on' : 'off'}
        onChange={(v) => setOn(v === 'on')}
      />
      {on ? (
        <>
          <ThemedText type="label" themeColor="textSecondary">
            Paid without a break for
          </ThemedText>
          <Stepper
            label="Paid without a break for"
            value={months}
            min={1}
            max={MAX_LOYALTY_MONTHS}
            format={(m) => `${m} ${m === 1 ? 'month' : 'months'}`}
            onChange={setMonths}
          />
          <ThemedText type="label" themeColor="textSecondary">
            Discount on renewal
          </ThemedText>
          <Stepper
            label="Discount on renewal"
            value={percent}
            min={1}
            max={MAX_LOYALTY_PERCENT}
            format={(p) => `${p}% off`}
            onChange={setPercent}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Applies on its own, in the app and at the front desk.
            {qualify !== null
              ? ` ${qualify} ${qualify === 1 ? 'member qualifies' : 'members qualify'} now.`
              : ''}
          </ThemedText>
        </>
      ) : null}

      {save.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {save.error.message}</ThemedText>
      ) : null}
      <Button
        label="Save"
        icon="checkmark"
        loading={save.isPending}
        onPress={() =>
          save.mutate(on ? { months, percent } : null, { onSuccess: () => router.back() })
        }
      />
    </Screen>
  );
}
