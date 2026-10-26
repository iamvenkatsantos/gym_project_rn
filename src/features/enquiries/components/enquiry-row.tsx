import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import {
  callUrl,
  enquirySummary,
  isOverdue,
  statusLabels,
  statusTones,
} from '@/features/enquiries/rules';
import type { Enquiry } from '@/features/enquiries/types';
import { useTheme } from '@/hooks/use-theme';

/** One enquiry in a list, with a call button so the desk can ring straight from it. */
export function EnquiryRow({
  enquiry,
  divider,
  onPress,
}: {
  enquiry: Enquiry;
  divider: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const overdue = isOverdue(enquiry);

  return (
    <View
      style={[
        styles.row,
        divider && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${enquiry.fullName}, ${statusLabels[enquiry.status]}`}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <View style={styles.text}>
          <View style={styles.title}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
              {enquiry.fullName}
            </ThemedText>
            <Pill label={statusLabels[enquiry.status]} tone={statusTones[enquiry.status]} />
          </View>
          {enquiry.interest ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {enquiry.interest}
            </ThemedText>
          ) : null}
          <ThemedText
            type="small"
            themeColor={overdue ? 'danger' : 'textSecondary'}
            numberOfLines={1}>
            {enquirySummary(enquiry)}
          </ThemedText>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Call ${enquiry.fullName}`}
        onPress={() => Linking.openURL(callUrl(enquiry.phone)).catch(() => {})}
        style={({ pressed }) => [
          styles.call,
          { backgroundColor: withAlpha(theme.accent, 0.14) },
          pressed && styles.pressed,
        ]}>
        <Icon name="call" size={20} color="accent" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TapTarget + 16,
  },
  main: {
    flex: 1,
    minWidth: 0,
    paddingVertical: Spacing.two,
  },
  text: {
    gap: Spacing.half,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
  },
  call: {
    width: TapTarget,
    height: TapTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
