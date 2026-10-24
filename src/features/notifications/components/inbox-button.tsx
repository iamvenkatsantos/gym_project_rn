import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useNotifications } from '@/features/notifications/hooks';
import { unreadCount } from '@/features/notifications/rules';
import { useTheme } from '@/hooks/use-theme';

/** Header bell that opens the inbox, with a badge for unread messages. */
export function InboxButton() {
  const theme = useTheme();
  const profile = useProfile();
  const gym = useActiveGym();
  const notifications = useNotifications(gym.gymId, profile.id);
  const unread = notifications.data ? unreadCount(notifications.data) : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `Inbox, ${unread} unread` : 'Inbox'}
      onPress={() => router.push('/notifications')}
      hitSlop={12}>
      <Icon name="notifications-outline" size={24} color="text" />
      {unread ? (
        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={[styles.count, { color: theme.onPrimary }]}>
            {unread > 9 ? '9+' : unread}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontSize: 10,
    lineHeight: 12,
  },
});
