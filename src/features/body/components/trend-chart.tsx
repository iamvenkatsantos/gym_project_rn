import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { formatValue, type Point } from '@/features/body/rules';
import type { MetricKey } from '@/features/body/types';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';

const CHART_HEIGHT = 120;
/** Enough bars to read a trend without them getting too thin to tap. */
const MAX_POINTS = 12;

type TrendChartProps = {
  points: Point[];
  metric: MetricKey;
};

/**
 * One metric over time as columns. The axis starts just below the lowest value so small
 * changes (a kilo, a centimetre) stay visible. Tap a column to read its value; the latest
 * one is shown until then.
 */
export function TrendChart({ points, metric }: TrendChartProps) {
  const theme = useTheme();
  const shown = points.slice(-MAX_POINTS);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = shown.find((p) => p.date === picked) ?? shown.at(-1);

  if (!selected) return null;

  const values = shown.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const spread = max - min || Math.max(max * 0.05, 1);
  const floor = min - spread * 0.5;
  const heightOf = (value: number) => Math.max(6, ((value - floor) / (max - floor)) * CHART_HEIGHT);

  return (
    <View style={styles.container}>
      <View style={styles.readout}>
        <ThemedText type="heading">{formatValue(selected.value, metric)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(selected.date)}
        </ThemedText>
      </View>
      <View style={[styles.plot, { borderBottomColor: theme.border }]}>
        {shown.map((point) => {
          const isSelected = point === selected;
          return (
            <Pressable
              key={point.date}
              accessibilityRole="button"
              accessibilityLabel={`${formatDate(point.date)}: ${formatValue(point.value, metric)}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => setPicked(point.date)}
              style={styles.slot}>
              <View
                style={[
                  styles.bar,
                  {
                    height: heightOf(point.value),
                    backgroundColor: isSelected ? theme.accent : withAlpha(theme.accent, 0.35),
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(shown[0].date)}
        </ThemedText>
        {shown.length > 1 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {formatDate(shown[shown.length - 1].date)}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  plot: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: 1,
  },
  // The whole column height is tappable, not just the bar.
  slot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },
  bar: {
    maxWidth: 28,
    width: '100%',
    alignSelf: 'center',
    borderTopLeftRadius: Radius.small / 2,
    borderTopRightRadius: Radius.small / 2,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
