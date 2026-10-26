import { StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/bar-chart';
import { Card } from '@/components/card';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { hourLabel, hourRangeLabel, weekdayName, type HourlyLoad } from '@/features/insights/rules';

/** When members arrive, by hour of the day and by weekday. */
export function BusiestHours({ load, days }: { load: HourlyLoad; days: number }) {
  if (load.total === 0) {
    return (
      <ThemedText themeColor="textSecondary">
        No member check-ins in the last {days} days yet.
      </ThemedText>
    );
  }

  return (
    <>
      <View style={styles.grid}>
        <StatTile
          label="Busiest hour"
          value={load.busiestHour === null ? undefined : hourRangeLabel(load.busiestHour)}
          icon="time-outline"
          accent
          compact
        />
        <StatTile
          label="Busiest day"
          value={load.busiestWeekday === null ? undefined : weekdayName(load.busiestWeekday)}
          icon="calendar-outline"
          compact
        />
      </View>
      <Card>
        <ThemedText type="smallBold">Check-ins by hour</ThemedText>
        <BarChart
          accessibilityLabel={load.byHour
            .filter((h) => h.checkIns > 0)
            .map((h) => `${hourRangeLabel(h.hour)}: ${h.checkIns}`)
            .join(', ')}
          bars={load.byHour.map((h) => ({
            key: String(h.hour),
            // Every third hour, so labels fit on a phone.
            label: h.hour % 3 === 0 ? hourLabel(h.hour) : '',
            value: h.checkIns,
            highlight: h.hour === load.busiestHour,
          }))}
        />
      </Card>
      <Card>
        <ThemedText type="smallBold">Check-ins by day</ThemedText>
        <BarChart
          height={90}
          accessibilityLabel={load.byWeekday
            .map((d) => `${weekdayName(d.weekday)}: ${d.checkIns}`)
            .join(', ')}
          bars={load.byWeekday.map((d) => ({
            key: String(d.weekday),
            label: weekdayName(d.weekday).slice(0, 3),
            value: d.checkIns,
            valueLabel: d.checkIns > 0 ? String(d.checkIns) : '',
            highlight: d.weekday === load.busiestWeekday,
          }))}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {load.total} member check-ins in the last {days} days, by arrival time.
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
