import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { useActiveGym } from '@/features/auth/use-profile';
import { useMemberRules, useSaveMemberRules } from '@/features/member-rules/hooks';
import type { MemberRules } from '@/features/member-rules/types';

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** Owners: membership pause, referral reward and class booking limit for this branch. */
export default function MemberRulesScreen() {
  const gym = useActiveGym();
  const rules = useMemberRules(gym.gymId);
  if (!rules.data) {
    return (
      <Screen refreshable={false}>
        <ThemedText themeColor={rules.error ? 'danger' : 'textSecondary'}>
          {rules.error ? rules.error.message : 'Loading…'}
        </ThemedText>
      </Screen>
    );
  }
  return <RulesForm gymId={gym.gymId} saved={rules.data} />;
}

function RulesForm({ gymId, saved }: { gymId: string; saved: MemberRules }) {
  const [pause, setPause] = useState(saved.pauseMaxDays);
  const [reward, setReward] = useState(saved.referralRewardDays);
  // 0 shows as No limit.
  const [cap, setCap] = useState(saved.classBookingCap ?? 0);
  const save = useSaveMemberRules(gymId);

  return (
    <Screen refreshable={false}>
      <SectionHeader title="Membership pause" />
      <Stepper
        label="Pause days per membership"
        value={pause}
        min={0}
        max={90}
        format={(n) => (n === 0 ? 'Off' : `Up to ${days(n)}`)}
        onChange={setPause}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Per membership. The end date moves by the days paused.
      </ThemedText>

      <SectionHeader title="Referral reward" />
      <Stepper
        label="Free days per friend who joins"
        value={reward}
        min={0}
        max={60}
        format={(n) => (n === 0 ? 'No reward' : `${days(n)} free`)}
        onChange={setReward}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Added once their friend&apos;s first paid membership is recorded.
      </ThemedText>

      <SectionHeader title="Class bookings" />
      <Stepper
        label="Classes a member can book at once"
        value={cap}
        min={0}
        max={20}
        format={(n) => (n === 0 ? 'No limit' : `${n} at a time`)}
        onChange={setCap}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Full classes take a waitlist that fills itself.
      </ThemedText>

      {save.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {save.error.message}</ThemedText>
      ) : null}
      <Button
        label="Save"
        icon="checkmark"
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { pauseMaxDays: pause, referralRewardDays: reward, classBookingCap: cap || null },
            { onSuccess: () => router.back() },
          )
        }
      />
    </Screen>
  );
}
