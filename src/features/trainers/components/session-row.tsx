import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { TrainerAvatar } from '@/features/trainers/components/trainer-avatar';
import type { TrainerSession } from '@/features/trainers/types';
import { useLargeText } from '@/hooks/use-large-text';
import { formatRelativeDay, formatTime } from '@/lib/format';

type SessionRowProps = {
  session: TrainerSession;
  /** Whose name to show: the trainer (member's view) or the member (trainer's view). */
  show: 'trainer' | 'member';
  highlighted?: boolean;
  action?: ReactNode;
};

export function SessionRow({ session, show, highlighted, action }: SessionRowProps) {
  const largeText = useLargeText();
  const name = show === 'trainer' ? session.trainerName : session.memberName;
  const minutes = Math.round(
    (new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime()) / 60000,
  );

  return (
    <Card highlighted={highlighted}>
      <View style={styles.row}>
        <View style={styles.time}>
          <ThemedText type="heading" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formatTime(session.startsAt)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatRelativeDay(session.startsAt)}
          </ThemedText>
        </View>
        <View style={styles.body}>
          <ThemedText type="heading">1:1 session</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {show === 'trainer' ? 'with ' : ''}
            {name} · {minutes} min
          </ThemedText>
        </View>
        {largeText ? null : <TrainerAvatar name={name} size={40} />}
      </View>
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  time: {
    minWidth: 72,
    // With a large phone font the time would otherwise squeeze the session name to one word a line.
    maxWidth: '35%',
  },
  body: {
    flex: 1,
    gap: Spacing.one,
  },
});
