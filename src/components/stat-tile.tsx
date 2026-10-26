import { Pressable, StyleSheet } from 'react-native';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StatTileProps = {
  label: string;
  value: number | string | undefined;
  icon: IconName;
  accent?: boolean;
  /** Smaller number so three fit across a phone. */
  compact?: boolean;
  /** Opens the screen behind the number, e.g. the renewals list. */
  onPress?: () => void;
};

export function StatTile({ label, value, icon, accent, compact, onPress }: StatTileProps) {
  const theme = useTheme();

  const content = (
    <>
      <Icon name={icon} size={20} color={accent ? 'accent' : 'textSecondary'} />
      <ThemedText type={compact ? 'heading' : 'title'} themeColor={accent ? 'accent' : 'text'}>
        {value ?? '–'}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </>
  );

  // A Pressable rather than a Card, so the tile is one box: a Card inside a Pressable would
  // size itself and clip a label that wraps.
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? 'loading'}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.tile,
          styles.pressableTile,
          compact && styles.compact,
          { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
        ]}>
        {content}
      </Pressable>
    );
  }

  return <Card style={[styles.tile, compact && styles.compact]}>{content}</Card>;
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: 140,
  },
  pressableTile: {
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  compact: {
    flexBasis: 90,
  },
});
