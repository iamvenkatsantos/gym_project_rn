import { StyleSheet, View } from 'react-native';

import { Pill, type PillTone } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { initials } from '@/features/trainers/rules';
import { useTheme } from '@/hooks/use-theme';

/** One person on an attendance list: who, a line of times or totals, and a status pill. */
export function AttendanceRow({
  name,
  detail,
  pill,
  divider,
  dimmed,
}: {
  name: string;
  detail: string;
  pill?: { label: string; tone: PillTone };
  divider: boolean;
  dimmed?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${name}, ${detail}${pill ? `, ${pill.label}` : ''}`}
      style={[
        styles.row,
        divider && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
      ]}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: theme.backgroundSelected },
          dimmed && styles.dimmed,
        ]}>
        <ThemedText type="smallBold">{initials(name)}</ThemedText>
      </View>
      <View style={[styles.text, dimmed && styles.dimmed]}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {detail}
        </ThemedText>
      </View>
      {pill ? <Pill label={pill.label} tone={pill.tone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingVertical: Spacing.two,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  dimmed: {
    opacity: 0.5,
  },
});
