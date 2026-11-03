import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ExerciseDemo } from '@/features/exercises/components/exercise-demo';
import { usePlanStretches } from '@/features/workouts/components/plan-stretches';
import { stretchSteps } from '@/features/workouts/stretches';

function seconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000));
}

/**
 * The last part of a live workout: the plan's stretches one at a time, each side on
 * its own, with a hold timer. Nothing here is logged; it only guides the cool-down.
 */
export function CoolDown({
  items,
  now,
}: {
  items: readonly { exerciseId: string; name: string }[];
  now: number;
}) {
  const steps = stretchSteps(usePlanStretches(items));
  const [index, setIndex] = useState(0);
  const [endsAt, setEndsAt] = useState<number | null>(null);

  const next = () => {
    setEndsAt(null);
    setIndex((i) => i + 1);
  };

  if (index >= steps.length) {
    return (
      <Card highlighted style={styles.center}>
        <Icon name="trophy-outline" size={40} color="accent" />
        <ThemedText type="heading">Workout complete</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Finish below to save it.
        </ThemedText>
        {steps.length > 0 ? (
          <Button
            label="Stretch again"
            icon="refresh"
            variant="secondary"
            size="compact"
            onPress={() => setIndex(0)}
          />
        ) : null}
      </Card>
    );
  }

  const { stretch, side } = steps[index];
  const holdMs = stretch.holdSeconds * 1000;
  const holding = endsAt !== null && endsAt > now;
  const held = endsAt !== null && endsAt <= now;

  return (
    <>
      <View>
        <ThemedText type="label" themeColor="textSecondary">
          Cool-down · {index + 1} of {steps.length}
        </ThemedText>
        <ProgressBar value={index / steps.length} color="accent" />
      </View>
      <ExerciseDemo key={stretch.id} exerciseId={stretch.id} name={stretch.name} />
      <View>
        <ThemedText type="title">{stretch.name}</ThemedText>
        <ThemedText type="small" themeColor="accent">
          {side ? `${side} · ` : ''}Hold {stretch.holdSeconds}s
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">{stretch.cue}</ThemedText>

      <Card highlighted style={styles.center}>
        <ThemedText
          type="display"
          themeColor="accent"
          accessibilityRole="timer"
          accessibilityLiveRegion="polite">
          {holding ? seconds(endsAt - now) : held ? 0 : stretch.holdSeconds}s
        </ThemedText>
        <View style={styles.fullWidth}>
          <ProgressBar value={holding ? (endsAt - now) / holdMs : held ? 0 : 1} color="accent" />
        </View>
        <View style={[styles.row, styles.fullWidth]}>
          <View style={styles.flex}>
            <Button label="Skip" variant="secondary" size="compact" onPress={next} />
          </View>
          <View style={styles.flex}>
            {held ? (
              <Button label="Next" icon="chevron-forward" size="compact" onPress={next} />
            ) : (
              <Button
                label={holding ? 'Restart' : 'Start'}
                icon={holding ? 'refresh' : 'play'}
                size="compact"
                onPress={() => setEndsAt(Date.now() + holdMs)}
              />
            )}
          </View>
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
