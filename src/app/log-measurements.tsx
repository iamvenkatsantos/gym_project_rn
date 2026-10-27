import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Stepper } from '@/components/stepper';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { ConfirmDelete } from '@/features/body/components/confirm-delete';
import { useDeleteMeasurement, useMeasurements, useSaveMeasurement } from '@/features/body/hooks';
import {
  emptyValues,
  hasAnyValue,
  latest,
  METRICS,
  parseMetric,
  validateMetric,
} from '@/features/body/rules';
import type { BodyMeasurement, MetricKey } from '@/features/body/types';
import { addDays, toIsoDate } from '@/features/memberships/rules';
import { formatDate } from '@/lib/format';
import { validateOptionalText } from '@/lib/validation';

/** Log or edit one day's measurements. Every field is optional; one is enough. */
export default function LogMeasurementsScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const measurements = useMeasurements(gym.gymId, profile.id);
  const today = toIsoDate(new Date());
  const [date, setDate] = useState(params.date ?? today);
  const offset = Math.round(
    (new Date(`${date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000,
  );

  return (
    <Screen refreshable={false}>
      <Stepper
        label="Date"
        value={offset}
        min={-365}
        max={0}
        format={(days) => (days === 0 ? 'Today' : formatDate(addDays(today, days)))}
        onChange={(days) => setDate(addDays(today, days))}
      />
      <QueryState query={measurements}>
        {(list) => (
          // Keyed by date so switching days loads that day's values.
          <MeasurementForm
            key={date}
            date={date}
            entries={list}
            gymId={gym.gymId}
            memberId={profile.id}
          />
        )}
      </QueryState>
    </Screen>
  );
}

type MeasurementFormProps = {
  date: string;
  entries: BodyMeasurement[];
  gymId: string;
  memberId: string;
};

function MeasurementForm({ date, entries, gymId, memberId }: MeasurementFormProps) {
  const save = useSaveMeasurement(gymId, memberId);
  const remove = useDeleteMeasurement(gymId, memberId);
  const existing = entries.find((e) => e.measuredOn === date);
  // Height rarely changes, so a new entry starts with the last one logged.
  const lastHeight = latest(entries, 'heightCm')?.value ?? null;
  const [texts, setTexts] = useState<Record<MetricKey, string>>(() => {
    const start = existing ?? { ...emptyValues(), heightCm: lastHeight };
    return Object.fromEntries(
      METRICS.map((m) => [m.key, start[m.key] === null ? '' : String(start[m.key])]),
    ) as Record<MetricKey, string>;
  });
  const [note, setNote] = useState(existing?.note ?? '');

  const errors = Object.fromEntries(
    METRICS.map((m) => [m.key, validateMetric(texts[m.key], m.key)]),
  ) as Record<MetricKey, string | null>;
  const noteError = validateOptionalText(note, 200);
  const values = emptyValues();
  for (const m of METRICS) values[m.key] = parseMetric(texts[m.key]);
  const valid = !noteError && METRICS.every((m) => !errors[m.key]) && hasAnyValue(values);
  const error = save.error ?? remove.error;

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        {existing
          ? 'You logged this day already. Change anything and save.'
          : 'Fill in what you measured. Measure at the same time of day, ideally in the morning.'}
      </ThemedText>
      {METRICS.map((m, i) => (
        <View key={m.key} style={styles.field}>
          {i === 2 ? <SectionHeader title="Tape measurements" /> : null}
          {m.key === 'heightCm' ? <SectionHeader title="For BMI" /> : null}
          <TextField
            label={`${m.label} (${m.unit})`}
            placeholder={m.key === 'weightKg' ? '72.5' : m.key === 'heightCm' ? '170' : undefined}
            value={texts[m.key]}
            onChangeText={(text) => setTexts((prev) => ({ ...prev, [m.key]: text }))}
            keyboardType="decimal-pad"
            maxLength={5}
            error={errors[m.key]}
          />
        </View>
      ))}
      <TextField
        label="Note (optional)"
        placeholder="e.g. after a week of travel"
        value={note}
        onChangeText={setNote}
        maxLength={200}
        error={noteError}
      />

      {error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {error.message}</ThemedText>
      ) : null}
      <Button
        label={existing ? 'Save changes' : 'Save'}
        icon="checkmark-circle-outline"
        disabled={!valid}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { ...values, measuredOn: date, note: note.trim() || null },
            { onSuccess: () => router.back() },
          )
        }
      />
      {existing ? (
        <View style={styles.delete}>
          <ConfirmDelete
            label="Delete this day"
            question={`Delete your measurements from ${formatDate(date)}?`}
            loading={remove.isPending}
            onConfirm={() => remove.mutate(existing.id, { onSuccess: () => router.back() })}
          />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two,
  },
  delete: {
    marginTop: Spacing.two,
  },
});
