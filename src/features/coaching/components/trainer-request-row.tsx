import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { TrainerRequest } from '@/features/coaching/types';
import { timeAgo } from '@/features/notifications/rules';

/** A member's request for a trainer, as owners and supervisors see it. */
export function TrainerRequestRow({
  request,
  onPress,
}: {
  request: TrainerRequest;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Trainer request from ${request.memberName}`}
      onPress={onPress}>
      <Card highlighted={request.status === 'pending'}>
        <View style={styles.row}>
          <Icon name="hand-right-outline" size={22} color="primary" />
          <View style={styles.flex}>
            <ThemedText type="smallBold">{request.memberName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {request.trainerName ? `Asked for ${request.trainerName}` : 'No preference'} ·{' '}
              {timeAgo(request.createdAt)}
            </ThemedText>
          </View>
          <Icon name="chevron-forward" size={18} />
        </View>
        <View style={styles.needs}>
          {request.needs.map((need) => (
            <Pill key={need} label={need} />
          ))}
        </View>
      </Card>
    </Pressable>
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
  needs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
});
