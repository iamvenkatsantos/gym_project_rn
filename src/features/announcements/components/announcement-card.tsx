import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { audienceLabel } from '@/features/announcements/rules';
import type { Announcement } from '@/features/announcements/types';
import { timeAgo } from '@/features/notifications/rules';

type AnnouncementCardProps = {
  announcement: Announcement;
  /** Owners and supervisors see who it went to. */
  showAudience?: boolean;
  highlighted?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
};

export function AnnouncementCard({
  announcement,
  showAudience,
  highlighted,
  onPress,
  onRemove,
}: AnnouncementCardProps) {
  const content = (
    <Card highlighted={highlighted}>
      <View style={styles.row}>
        <Icon name="megaphone-outline" size={22} color="accent" />
        <View style={styles.flex}>
          <ThemedText type="smallBold">{announcement.title}</ThemedText>
          {announcement.body ? (
            <ThemedText type="small" themeColor="textSecondary">
              {announcement.body}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            {[announcement.senderName, timeAgo(announcement.createdAt)].filter(Boolean).join(' · ')}
          </ThemedText>
          {showAudience ? (
            <View style={styles.pill}>
              <Pill label={`To ${audienceLabel(announcement.audience).toLowerCase()}`} />
            </View>
          ) : null}
        </View>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${announcement.title}`}
            onPress={onRemove}
            hitSlop={12}>
            <Icon name="trash-outline" size={20} color="textSecondary" />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
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
  pill: {
    flexDirection: 'row',
    marginTop: Spacing.one,
  },
});
