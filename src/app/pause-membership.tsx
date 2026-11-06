import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useMemberRules } from '@/features/member-rules/hooks';
import { useMemberMemberships, usePauseMembership } from '@/features/memberships/hooks';
import { MAX_PAUSE_LEAD_DAYS, membershipOn, pauseDaysLeft } from '@/features/memberships/pause';
import { addDays, spellDate, toIsoDate } from '@/features/memberships/rules';

/** Pause a membership: pick when it starts and for how many days. */
export default function PauseMembershipScreen() {
  const { memberId: param } = useLocalSearchParams<{ memberId?: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const memberId = param ?? profile.id;
  const rules = useMemberRules(gym.gymId).data;
  const memberships = useMemberMemberships(gym.gymId, memberId).data;
  const pause = usePauseMembership(gym.gymId);
  const [startIn, setStartIn] = useState(0);
  const [days, setDays] = useState(7);

  if (!rules || !memberships) {
    return (
      <Screen refreshable={false}>
        <ThemedText themeColor="textSecondary">Loading…</ThemedText>
      </Screen>
    );
  }

  const today = toIsoDate(new Date());
  const startsOn = addDays(today, startIn);
  const membership = membershipOn(memberships, startsOn);
  const left = membership ? pauseDaysLeft(membership, rules.pauseMaxDays) : 0;
  const length = Math.min(days, Math.max(left, 1));
  const lastDay = addDays(startsOn, length - 1);

  return (
    <Screen refreshable={false}>
      <ThemedText type="label" themeColor="textSecondary">
        Starts
      </ThemedText>
      <Stepper
        label="Pause starts"
        value={startIn}
        min={0}
        max={MAX_PAUSE_LEAD_DAYS}
        format={(n) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : spellDate(addDays(today, n)))}
        onChange={setStartIn}
      />
      <ThemedText type="label" themeColor="textSecondary">
        For
      </ThemedText>
      <Stepper
        label="Pause for"
        value={length}
        min={1}
        max={Math.max(left, 1)}
        format={(n) => `${n} ${n === 1 ? 'day' : 'days'}`}
        onChange={setDays}
      />

      {membership && left > 0 ? (
        <Card>
          <ThemedText type="smallBold">
            Paused {spellDate(startsOn)} to {spellDate(lastDay)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Ends {spellDate(addDays(membership.endsOn, length))} instead of{' '}
            {spellDate(membership.endsOn)}.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Bookings in these days are cancelled.
          </ThemedText>
        </Card>
      ) : (
        <ThemedText themeColor="warning">
          {membership ? 'No pause days left on this membership.' : 'No membership on that day.'}
        </ThemedText>
      )}

      {pause.error ? <ThemedText themeColor="danger">{pause.error.message}</ThemedText> : null}
      <Button
        label="Pause"
        icon="pause"
        disabled={!membership || left === 0}
        loading={pause.isPending}
        onPress={() =>
          pause.mutate({ memberId, startsOn, days: length }, { onSuccess: () => router.back() })
        }
      />
    </Screen>
  );
}
