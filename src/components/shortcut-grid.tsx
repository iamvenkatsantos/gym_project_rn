import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Shortcut = {
  label: string;
  icon: IconName;
  onPress: () => void;
  /** A count to act on, shown as a badge on the icon, e.g. follow-ups due today. */
  badge?: number;
};

/** Small icon tiles, three across, for screens a manager opens from their dashboard. */
export function ShortcutGrid({ shortcuts }: { shortcuts: Shortcut[] }) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {shortcuts.map(({ label, icon, onPress, badge }) => (
        <Pressable
          key={label}
          accessibilityRole="button"
          accessibilityLabel={badge ? `${label}, ${badge} due` : label}
          onPress={onPress}
          style={({ pressed }) => [
            styles.tile,
            { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
          ]}>
          <View style={[styles.icon, { backgroundColor: withAlpha(theme.accent, 0.14) }]}>
            <Icon name={icon} size={20} color="accent" />
            {badge ? (
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <ThemedText type="smallBold" themeColor="onPrimary" style={styles.badgeText}>
                  {badge}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText type="smallBold" numberOfLines={2} style={styles.label}>
            {label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    // Three across: a third of the row minus its share of the two gaps.
    width: `${100 / 3}%`,
    flexGrow: 1,
    flexBasis: 90,
    minHeight: TapTarget + Spacing.five,
    borderRadius: Radius.medium,
    padding: Spacing.two,
    gap: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 14,
  },
  label: {
    textAlign: 'center',
    fontSize: 13,
  },
});
