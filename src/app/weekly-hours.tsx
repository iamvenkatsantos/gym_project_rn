import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import type { WeeklyHours } from '@/features/trainers/api';
import {
  addWindow,
  availabilityProblem,
  copyToWeekdays,
  fromMinutes,
  removeWindow,
  SessionLimits,
  TimeStep,
  toMinutes,
  updateWindow,
  weekdayNames,
  weekdayOrder,
  windowsForDay,
} from '@/features/trainers/availability-rules';
import { useSaveWeeklyHours, useWeeklyHours } from '@/features/trainers/hooks';

export default function WeeklyHoursScreen() {
  const profile = useProfile();
  const gym = useActiveGym();
  const hours = useWeeklyHours(gym.gymId, profile.id);

  return (
    <Screen>
      <QueryState query={hours}>
        {(initial) => <HoursForm gymId={gym.gymId} trainerId={profile.id} initial={initial} />}
      </QueryState>
    </Screen>
  );
}

function HoursForm({
  gymId,
  trainerId,
  initial,
}: {
  gymId: string;
  trainerId: string;
  initial: WeeklyHours;
}) {
  const [sessionMinutes, setSessionMinutes] = useState(initial.sessionMinutes);
  const [windows, setWindows] = useState(initial.availability);
  const save = useSaveWeeklyHours(gymId, trainerId);
  const problem = availabilityProblem(windows);

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        Members can book 1:1 sessions inside these hours, in the gym&apos;s local time. Sessions
        already booked stay booked if you change them.
      </ThemedText>

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary">
          Session length
        </ThemedText>
        <Stepper
          label="Session length"
          value={sessionMinutes}
          {...SessionLimits}
          format={(m) => `${m} min`}
          onChange={setSessionMinutes}
        />
      </View>

      <SectionHeader title="Weekly hours" />
      {weekdayOrder.map((weekday) => {
        const day = windowsForDay(windows, weekday);
        return (
          <Card key={weekday}>
            <View style={styles.dayHeader}>
              <ThemedText type="heading" style={styles.flex}>
                {weekdayNames[weekday]}
              </ThemedText>
              {day.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Off
                </ThemedText>
              ) : null}
            </View>
            {day.map((w) => (
              <View key={`${w.startTime}-${w.endTime}`} style={styles.window}>
                <View style={styles.flex}>
                  <Stepper
                    label={`${weekdayNames[weekday]} start`}
                    value={toMinutes(w.startTime)}
                    step={TimeStep}
                    min={0}
                    max={toMinutes(w.endTime) - TimeStep}
                    format={fromMinutes}
                    onChange={(m) =>
                      setWindows((all) => updateWindow(all, w, { startTime: fromMinutes(m) }))
                    }
                  />
                </View>
                <ThemedText themeColor="textSecondary">to</ThemedText>
                <View style={styles.flex}>
                  <Stepper
                    label={`${weekdayNames[weekday]} end`}
                    value={toMinutes(w.endTime)}
                    step={TimeStep}
                    min={toMinutes(w.startTime) + TimeStep}
                    max={23 * 60 + 30}
                    format={fromMinutes}
                    onChange={(m) =>
                      setWindows((all) => updateWindow(all, w, { endTime: fromMinutes(m) }))
                    }
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${weekdayNames[weekday]} ${w.startTime} to ${w.endTime}`}
                  onPress={() => setWindows((all) => removeWindow(all, w))}
                  hitSlop={8}
                  style={styles.remove}>
                  <Icon name="close-circle" size={24} />
                </Pressable>
              </View>
            ))}
            <View style={styles.dayActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setWindows((all) => addWindow(all, weekday))}
                style={styles.link}>
                <Icon name="add" size={18} color="accent" />
                <ThemedText type="linkPrimary">Add hours</ThemedText>
              </Pressable>
              {day.length > 0 && weekday !== 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setWindows((all) => copyToWeekdays(all, weekday))}
                  style={styles.link}>
                  <Icon name="copy-outline" size={16} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Copy to Mon–Sat
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          </Card>
        );
      })}

      {problem ? <ThemedText themeColor="danger">{problem}</ThemedText> : null}
      {save.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {save.error.message}</ThemedText>
      ) : null}
      <View style={styles.footer}>
        <Button
          label="Save hours"
          icon="checkmark"
          disabled={!!problem}
          loading={save.isPending}
          onPress={() =>
            save.mutate(
              { sessionMinutes, availability: windows },
              { onSuccess: () => router.back() },
            )
          }
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  field: {
    gap: Spacing.one,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  window: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  remove: {
    width: 32,
    alignItems: 'center',
  },
  dayActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
  },
  footer: {
    paddingTop: Spacing.two,
  },
});
