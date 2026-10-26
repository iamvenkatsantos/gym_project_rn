import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { QueryState } from '@/components/query-state';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ProgressPhotos } from '@/features/body/components/progress-photos';
import { TrendChart } from '@/features/body/components/trend-chart';
import { useMeasurements } from '@/features/body/hooks';
import {
  bmi,
  bmiCategory,
  change,
  formatChange,
  formatValue,
  latest,
  METRICS,
  metricInfo,
  series,
  trackedMetrics,
} from '@/features/body/rules';
import type { BodyMeasurement, MetricKey } from '@/features/body/types';
import { formatDate } from '@/lib/format';

type BodyProgressProps = {
  gymId: string;
  memberId: string;
  /** The member's own view: can log and edit. Coaches and managers only read. */
  editable: boolean;
};

/** Weight, BMI, body fat and tape measurements over time, then progress photos. */
export function BodyProgress({ gymId, memberId, editable }: BodyProgressProps) {
  const measurements = useMeasurements(gymId, memberId);

  return (
    <>
      {editable ? (
        <Button
          label="Log measurements"
          icon="add-circle-outline"
          onPress={() => router.push('/log-measurements')}
        />
      ) : null}
      <QueryState
        query={measurements}
        isEmpty={(list) => list.length === 0}
        emptyText={
          editable
            ? 'Log your weight and measurements every week or two to see your trend.'
            : 'No measurements logged yet.'
        }>
        {(list) => <MeasurementOverview entries={list} editable={editable} />}
      </QueryState>
      <ProgressPhotos gymId={gymId} memberId={memberId} editable={editable} />
    </>
  );
}

function MeasurementOverview({
  entries,
  editable,
}: {
  entries: BodyMeasurement[];
  editable: boolean;
}) {
  const tracked = trackedMetrics(entries);
  const [picked, setPicked] = useState<MetricKey | null>(null);
  const metric = picked && tracked.includes(picked) ? picked : (tracked[0] ?? null);
  const weight = latest(entries, 'weightKg');
  const fat = latest(entries, 'bodyFatPct');
  const index = bmi(entries);
  const points = metric ? series(entries, metric) : [];
  const delta = change(points);

  return (
    <>
      <View style={styles.grid}>
        <StatTile
          label="Weight"
          value={weight ? formatValue(weight.value, 'weightKg') : undefined}
          icon="scale-outline"
          accent
          compact
        />
        <StatTile label="BMI" value={index ?? undefined} icon="body-outline" compact />
        <StatTile
          label="Body fat"
          value={fat ? formatValue(fat.value, 'bodyFatPct') : undefined}
          icon="water-outline"
          compact
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {index
          ? `A BMI of ${index} is in the ${bmiCategory(index).toLowerCase()} for adults (WHO).`
          : 'Log your height once to see your BMI.'}
      </ThemedText>

      {metric ? (
        <>
          <SectionHeader title="Trend" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}>
            {tracked.map((key) => (
              <Chip
                key={key}
                label={metricInfo(key).label}
                selected={metric === key}
                onPress={() => setPicked(key)}
              />
            ))}
          </ScrollView>
          <Card>
            <TrendChart key={metric} points={points} metric={metric} />
            <ThemedText type="small" themeColor="textSecondary">
              {delta === null
                ? 'Log again to see the change.'
                : `${formatChange(delta, metric)} since ${formatDate(points[0].date)}`}
            </ThemedText>
          </Card>
        </>
      ) : null}

      <SectionHeader title="Measurements" detail={`${entries.length} logged`} />
      {entries.slice(0, 10).map((entry) => (
        <Pressable
          key={entry.id}
          disabled={!editable}
          accessibilityRole={editable ? 'button' : undefined}
          accessibilityHint={editable ? 'Edit this day' : undefined}
          onPress={() =>
            router.push({ pathname: '/log-measurements', params: { date: entry.measuredOn } })
          }>
          <Card>
            <ThemedText type="smallBold">{formatDate(entry.measuredOn)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {METRICS.filter((m) => entry[m.key] !== null)
                .map((m) => `${m.label} ${formatValue(entry[m.key] as number, m.key)}`)
                .join(' · ')}
            </ThemedText>
            {entry.note ? <ThemedText type="small">{entry.note}</ThemedText> : null}
          </Card>
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  chips: {
    gap: Spacing.two,
  },
});
