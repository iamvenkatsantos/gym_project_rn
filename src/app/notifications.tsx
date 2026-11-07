import { useEffect, useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { callUrl, whatsappUrl } from '@/features/enquiries/rules';
import { useMarkAllRead, useNotifications } from '@/features/notifications/hooks';
import { inboxSections, timeAgo, unreadCount } from '@/features/notifications/rules';
import type { AppNotification, NotificationKind } from '@/features/notifications/types';
import { useTheme } from '@/hooks/use-theme';

const kindIcon: Record<NotificationKind, IconName> = {
  message: 'chatbubble-ellipses-outline',
  trainer_request: 'hand-right-outline',
  trainer_assigned: 'people-outline',
  reminder: 'alarm-outline',
  booking: 'calendar-outline',
  membership: 'card-outline',
  attendance: 'barbell-outline',
  announcement: 'megaphone-outline',
  birthday: 'gift-outline',
  workout: 'fitness-outline',
};

export default function NotificationsScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const notifications = useNotifications(gym.gymId, profile.id);
  const markRead = useMarkAllRead(gym.gymId, profile.id);
  const marked = useRef(false);

  // Opening the inbox reads everything in it; the dots show what was new this time. Older
  // notifications drop off from tomorrow (`inInbox`), today's stay all day.
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
        emptyText="You're all caught up.">
        {(list) => {
          const { today, earlier } = inboxSections(list);
          return (
            <>
              {today.length > 0 ? <SectionHeader title="Today" /> : null}
              {today.map((n) => (
                <NotificationCard key={n.id} n={n} />
              ))}
              {earlier.length > 0 ? <SectionHeader title="Earlier" /> : null}
              {earlier.map((n) => (
                <NotificationCard key={n.id} n={n} />
              ))}
            </>
          );
        }}
      </QueryState>
    </Screen>
  );
}

function NotificationCard({ n }: { n: AppNotification }) {
  const theme = useTheme();
  return (
    <Card highlighted={!n.readAt}>
      <View style={styles.row}>
        <Icon name={kindIcon[n.kind]} size={22} color={n.readAt ? 'textSecondary' : 'accent'} />
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
      {n.phone ? <CallButtons phone={n.phone} /> : null}
    </Card>
  );
}

/** Call or WhatsApp the number a notification carries, e.g. a referred friend. */
function CallButtons({ phone }: { phone: string }) {
  return (
    <View style={styles.actions}>
      <View style={styles.flex}>
        <Button
          label="Call"
          icon="call"
          size="compact"
          onPress={() => Linking.openURL(callUrl(phone)).catch(() => {})}
        />
      </View>
      <View style={styles.flex}>
        <Button
          label="WhatsApp"
          icon="logo-whatsapp"
          variant="secondary"
          size="compact"
          onPress={() => Linking.openURL(whatsappUrl(phone)).catch(() => {})}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
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
