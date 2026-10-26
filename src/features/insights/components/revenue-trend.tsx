import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { Card } from '@/components/card';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  compactMoney,
  formatChange,
  monthLabel,
  revenueSummary,
  wholeMoney,
} from '@/features/insights/rules';
import type { MonthRevenue } from '@/features/insights/types';

/** This month's takings against last month, and a bar per month. */
export function RevenueTrend({ months }: { months: MonthRevenue[] }) {
  const summary = revenueSummary(months);
  const currency = months[0]?.currency ?? 'INR';
  const money = (cents: number) => wholeMoney(cents, currency);

  return (
    <>
      <View style={styles.grid}>
        <StatTile
          label="This month"
          value={summary.thisMonth && money(summary.thisMonth.amountCents)}
          icon="wallet-outline"
          accent
          compact
        />
        <StatTile
          label="vs last month"
          value={summary.change === null ? '–' : formatChange(summary.change)}
          icon={summary.change !== null && summary.change < 0 ? 'trending-down' : 'trending-up'}
          compact
        />
        <StatTile
          label="New members"
          value={summary.thisMonth?.newMembers}
          icon="person-add-outline"
          compact
        />
      </View>
      <Card>
        <BarChart
          accessibilityLabel={months
            .map((m) => `${monthLabel(m.month)}: ${money(m.amountCents)}`)
            .join(', ')}
          bars={months.map((m, i) => ({
            key: m.month,
            label: monthLabel(m.month),
            value: m.amountCents,
            valueLabel: m.amountCents > 0 ? compactMoney(m.amountCents, currency) : '',
            highlight: i === months.length - 1,
          }))}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {summary.monthlyAverageCents === null
            ? 'Payments count in the month they were recorded.'
            : `Average ${money(summary.monthlyAverageCents)} a month before this one. Payments count in the month they were recorded.`}
        </ThemedText>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
});
