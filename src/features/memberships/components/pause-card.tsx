import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMemberRules } from '@/features/member-rules/hooks';
import { useEndPause, useMemberMemberships } from '@/features/memberships/hooks';
import {
  findCurrentPause,
  membershipOn,
  pauseDaysLeft,
  pauseLength,
} from '@/features/memberships/pause';
import { spellDate, toIsoDate } from '@/features/memberships/rules';

/**
 * A member's pause, with Resume or Cancel, or a Pause button when the gym allows it.
 * Members see it for themselves; owners and supervisors on the person screen.
 */
export function PauseCard({ gymId, memberId }: { gymId: string; memberId: string }) {
  const rules = useMemberRules(gymId).data;
  const memberships = useMemberMemberships(gymId, memberId).data;
  const end = useEndPause();
  if (!rules || !memberships) return null;

  const today = toIsoDate(new Date());
  const pause = findCurrentPause(memberships, today);

  if (pause) {
    const started = pause.startsOn <= today;
    return (
      <Card>
        <View style={styles.row}>
          <Icon name="pause-circle-outline" size={22} color="warning" />
          <View style={styles.flex}>
            <ThemedText type="smallBold">
              {started ? `Paused until ${spellDate(pause.endsOn)}` : 'Pause planned'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {started
                ? 'No check-in or bookings till then.'
                : `${spellDate(pause.startsOn)} to ${spellDate(pause.endsOn)} · ${pauseLength(pause)} days`}
            </ThemedText>
          </View>
        </View>
        {end.error ? (
          <ThemedText type="small" themeColor="danger">
            {end.error.message}
          </ThemedText>
        ) : null}
        <Button
          label={started ? 'Resume now' : 'Cancel pause'}
          icon={started ? 'play-outline' : 'close'}
          variant="secondary"
          size="compact"
          loading={end.isPending}
          onPress={() => end.mutate(pause.id)}
        />
      </Card>
    );
  }

  const running = membershipOn(memberships, today);
  if (rules.pauseMaxDays === 0 || !running) return null;
  const left = pauseDaysLeft(running, rules.pauseMaxDays);
  return (
    <Button
      label={left > 0 ? `Pause membership · ${left} days left` : 'No pause days left'}
      icon="pause-outline"
      variant="secondary"
      size="compact"
      disabled={left === 0}
      onPress={() => router.push({ pathname: '/pause-membership', params: { memberId } })}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
});
