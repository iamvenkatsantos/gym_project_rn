import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget, withAlpha, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A card of rows, like a settings group. Rows after the first get a divider. */
export function ListGroup({ children }: { children: ReactNode }) {
  return <Card style={styles.group}>{children}</Card>;
}

type ListRowProps = {
  label: string;
  icon: IconName;
  /** Grey text under the label. */
  detail?: string;
  /** Shown at the end of the row instead of the chevron. */
  trailing?: ReactNode;
  tone?: Extract<ThemeColor, 'accent' | 'danger'>;
  divider?: boolean;
  onPress?: () => void;
};

export function ListRow({
  label,
  icon,
  detail,
  trailing,
  tone = 'accent',
  divider,
  onPress,
}: ListRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      <View style={[styles.icon, { backgroundColor: withAlpha(theme[tone], 0.14) }]}>
        <Icon name={icon} size={18} color={tone} />
      </View>
      <View style={styles.text}>
        <ThemedText type="smallBold" themeColor={tone === 'danger' ? 'danger' : 'text'}>
          {label}
        </ThemedText>
        {detail ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevron-forward" size={18} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: TapTarget + Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
