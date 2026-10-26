import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Bar = {
  key: string;
  /** Under the bar. Leave empty to skip a label where bars are narrow. */
  label: string;
  value: number;
  /** Above the bar, e.g. "₹45k". */
  valueLabel?: string;
  /** Drawn in the brand fill, e.g. this month or the busiest hour. */
  highlight?: boolean;
};

type BarChartProps = {
  bars: Bar[];
  /** Read out by screen readers in place of the bars. */
  accessibilityLabel: string;
  height?: number;
};

const VALUE_LABEL_HEIGHT = 18;

/** Plain vertical bars scaled to the largest value. Needs no native chart library. */
export function BarChart({ bars, accessibilityLabel, height = 120 }: BarChartProps) {
  const theme = useTheme();
  const max = Math.max(...bars.map((b) => b.value), 0);
  // Room above the tallest bar for its value label.
  const room = bars.some((b) => b.valueLabel) ? height - VALUE_LABEL_HEIGHT : height;
  // A sliver for small values so they don't look like nothing.
  const barHeight = (value: number) =>
    max > 0 && value > 0 ? Math.max((value / max) * room, 2) : 0;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.plot, { height, borderBottomColor: theme.border }]}>
        {bars.map((bar) => (
          <View key={bar.key} style={styles.column}>
            {bar.valueLabel ? (
              <ThemedText
                type="small"
                themeColor={bar.highlight ? 'accent' : 'textSecondary'}
                numberOfLines={1}
                style={styles.valueLabel}>
                {bar.valueLabel}
              </ThemedText>
            ) : null}
            <View
              style={[
                styles.bar,
                {
                  height: barHeight(bar.value),
                  backgroundColor: bar.highlight ? theme.primary : withAlpha(theme.accent, 0.35),
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {bars.map((bar) => (
          <ThemedText
            key={bar.key}
            type="small"
            themeColor={bar.highlight ? 'text' : 'textSecondary'}
            numberOfLines={1}
            style={styles.label}>
            {bar.label}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  column: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 40,
    borderTopLeftRadius: Radius.small / 2,
    borderTopRightRadius: Radius.small / 2,
  },
  valueLabel: {
    fontSize: 11,
    lineHeight: VALUE_LABEL_HEIGHT,
  },
  labels: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  label: {
    flex: 1,
    fontSize: 11,
    textAlign: 'center',
    // Lets "12pm" spill over a narrow column instead of wrapping.
    marginHorizontal: -Spacing.two,
  },
});
