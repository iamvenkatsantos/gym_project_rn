import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PillTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

const toneColor = {
  accent: 'accent',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  neutral: 'textSecondary',
} as const;

type PillProps = {
  label: string;
  tone?: PillTone;
  icon?: IconName;
};

export function Pill({ label, tone = 'neutral', icon }: PillProps) {
  const theme = useTheme();
  const color = toneColor[tone];

  return (
    <View style={[styles.pill, { backgroundColor: withAlpha(theme[color], 0.12) }]}>
      {icon ? <Icon name={icon} size={12} color={color} /> : null}
      <ThemedText type="label" themeColor={color} style={styles.text}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
  },
  text: {
    fontSize: 11,
    letterSpacing: 0.8,
  },
});
