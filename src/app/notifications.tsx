import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useMarkAllRead, useNotifications } from '@/features/notifications/hooks';
import { timeAgo, unreadCount } from '@/features/notifications/rules';
import type { NotificationKind } from '@/features/notifications/types';
import { useTheme } from '@/hooks/use-theme';

const kindIcon: Record<NotificationKind, IconName> = {
  message: 'chatbubble-ellipses-outline',
  trainer_request: 'hand-right-outline',
  trainer_assigned: 'people-outline',
  reminder: 'alarm-outline',
  booking: 'calendar-outline',
  membership: 'card-outline',
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const profile = useProfile();
  const gym = useActiveGym();
  const notifications = useNotifications(gym.gymId, profile.id);
  const markRead = useMarkAllRead(gym.gymId, profile.id);
  const marked = useRef(false);

  // Opening the inbox reads everything in it; the dots show what was new this time.
  useEffect(() => {
    if (!marked.current && notifications.data && unreadCount(notifications.data) > 0) {
      marked.current = true;
      markRead.mutate();
    }
  }, [notifications.data, markRead]);

  return (
    <Screen>
      <QueryState
        query={notifications}
        isEmpty={(list) => list.length === 0}
        emptyText="Nothing here yet. Messages from your gym show up here.">
        {(list) =>
          list.map((n) => (
            <Card key={n.id} highlighted={!n.readAt}>
              <View style={styles.row}>
                <Icon
                  name={kindIcon[n.kind]}
                  size={22}
                  color={n.readAt ? 'textSecondary' : 'primary'}
                />
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{n.title}</ThemedText>
                  {n.body ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {n.body}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    {[n.senderName, timeAgo(n.createdAt)].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                {!n.readAt ? (
                  <View
                    accessibilityLabel="Unread"
                    style={[styles.dot, { backgroundColor: theme.primary }]}
                  />
                ) : null}
              </View>
            </Card>
          ))
        }
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    marginTop: 6,
  },
});
