import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ProgressBar } from '@/components/progress-bar';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing, TapTarget } from '@/constants/theme';
import { ExerciseDemo } from '@/features/exercises/components/exercise-demo';
import type { Exercise } from '@/features/exercises/types';
import { useWorkoutDraft, type WorkoutDraft } from '@/features/progress/draft-store';
import {
  exerciseDone,
  nextSet,
  nextSetIn,
  REST_STEP,
  setCounts,
  setTarget,
  WEIGHT_STEP,
} from '@/features/progress/live';
import { useTheme } from '@/hooks/use-theme';

function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const noSet = { reps: 0, weightKg: null, done: false };
const noExercise = { exerciseId: '', name: '', restSeconds: 0, sets: [noSet] };

export type Live = ReturnType<typeof useLiveWorkout>;

/** State shared by the live view and its pinned set bar. */
export function useLiveWorkout(
  draft: WorkoutDraft,
  focus: number,
  onFocus: (exercise: number) => void,
  now: number,
) {
  const restUntil = useWorkoutDraft((s) => s.restUntil);
  const { toggleSet, updateSet, addSet } = useWorkoutDraft();
  const [picked, setPicked] = useState<{ exercise: number; set: number } | null>(null);
  const [howTo, setHowTo] = useState(false);

  const current = Math.min(focus, draft.exercises.length - 1);
  const exercise = draft.exercises[current] ?? noExercise;
  const upNext = nextSet(draft, current);
  const resting = restUntil !== null && restUntil > now;
  const auto = nextSetIn(exercise);
  const setIndex =
    picked?.exercise === current && picked.set < exercise.sets.length
      ? picked.set
      : (auto ?? exercise.sets.length - 1);
  const set = exercise.sets[setIndex] ?? noSet;

  const go = (i: number) => {
    setPicked(null);
    setHowTo(false);
    onFocus(i);
  };

  const doSet = () => {
    toggleSet(current, setIndex);
    setPicked(null);
    const after = useWorkoutDraft.getState().draft;
    // Last set of this exercise: move on to the next one by itself.
    if (!set.done && after && exerciseDone(after.exercises[current])) {
      const next = nextSet(after, current);
      if (next && next.exercise !== current) go(next.exercise);
    }
  };

  return {
    draft,
    now,
    restUntil,
    current,
    exercise,
    upNext,
    resting,
    setIndex,
    set,
    howTo,
    setHowTo,
    go,
    doSet,
    pickSet: (i: number) => setPicked({ exercise: current, set: i }),
    addSet: () => {
      addSet(current);
      setPicked({ exercise: current, set: exercise.sets.length });
    },
    updateSet: (patch: { reps?: number; weightKg?: number | null }) =>
      updateSet(current, setIndex, patch),
  };
}

/**
 * The guided workout: one exercise on screen with its demo and how-to and its sets as
 * dots, then a full rest screen showing what's next. Reps, kg and Done sit in
 * LiveSetBar, pinned under the screen. An exercise's last set moves on by itself.
 */
export function LiveWorkout({
  live,
  library,
  onReplace,
}: {
  live: Live;
  library: readonly Exercise[] | undefined;
  onReplace: (exercise: number) => void;
}) {
  useKeepAwake();
  const { skipRest, extendRest } = useWorkoutDraft();
  const { draft, now, restUntil, current, exercise, upNext, setIndex, howTo, setHowTo, go } = live;
  const info = library?.find((e) => e.id === exercise.exerciseId);
  const counts = setCounts(draft);

  if (live.resting && upNext && restUntil !== null) {
    const nextExercise = draft.exercises[upNext.exercise];
    const restTotal = Math.max(1, nextExercise.restSeconds * 1000);
    return (
      <>
        <Progress done={counts.done} total={counts.total} />
        <Card highlighted style={styles.restCard}>
          <ThemedText type="label" themeColor="textSecondary">
            Rest
          </ThemedText>
          <ThemedText
            type="display"
            themeColor="accent"
            accessibilityRole="timer"
            accessibilityLiveRegion="polite">
            {clock(restUntil - now)}
          </ThemedText>
          <View style={styles.fullWidth}>
            <ProgressBar value={(restUntil - now) / restTotal} color="accent" />
          </View>
          <View style={[styles.row, styles.fullWidth]}>
            <View style={styles.flex}>
              <Button
                label={`+${REST_STEP}s`}
                icon="add"
                variant="secondary"
                size="compact"
                onPress={() => extendRest(REST_STEP)}
              />
            </View>
            <View style={styles.flex}>
              <Button label="Skip" icon="play-skip-forward" size="compact" onPress={skipRest} />
            </View>
          </View>
        </Card>
        <ThemedText type="label" themeColor="textSecondary">
          Up next
        </ThemedText>
        <Card>
          <View style={styles.row}>
            <ExerciseDemo
              exerciseId={nextExercise.exerciseId}
              name={nextExercise.name}
              variant="thumb"
              animate
            />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{nextExercise.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Set {upNext.set + 1} of {nextExercise.sets.length} ·{' '}
                {setTarget(nextExercise.sets[upNext.set])}
              </ThemedText>
            </View>
          </View>
        </Card>
      </>
    );
  }

  if (!upNext) {
    return (
      <>
        <Progress done={counts.done} total={counts.total} />
        <Card highlighted style={styles.restCard}>
          <Icon name="trophy-outline" size={40} color="accent" />
          <ThemedText type="heading">All sets done</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Stretch, then finish below.
          </ThemedText>
        </Card>
      </>
    );
  }

  const allDone = exerciseDone(exercise);

  return (
    <>
      <Progress done={counts.done} total={counts.total} />
      <View style={styles.row}>
        <NavButton
          icon="chevron-back"
          label="Previous exercise"
          disabled={current === 0}
          onPress={() => go(current - 1)}
        />
        <ThemedText type="label" themeColor="textSecondary" style={[styles.flex, styles.center]}>
          Exercise {current + 1} of {draft.exercises.length}
        </ThemedText>
        <NavButton
          icon="chevron-forward"
          label="Next exercise"
          disabled={current === draft.exercises.length - 1}
          onPress={() => go(current + 1)}
        />
      </View>

      <ExerciseDemo
        key={exercise.exerciseId}
        exerciseId={exercise.exerciseId}
        name={exercise.name}
      />
      <View>
        <ThemedText type="title">{exercise.name}</ThemedText>
        {info ? (
          <ThemedText type="small" themeColor="textSecondary">
            {[...info.muscleGroups.map(capitalise), capitalise(info.equipment)].join(' · ')}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.links}>
        {info && info.instructions.length > 0 ? (
          <LinkButton
            icon={howTo ? 'chevron-up' : 'list-outline'}
            label={howTo ? 'Hide steps' : 'How to do it'}
            expanded={howTo}
            onPress={() => setHowTo((v) => !v)}
          />
        ) : null}
        <LinkButton icon="swap-horizontal" label="Replace" onPress={() => onReplace(current)} />
        <LinkButton
          icon="information-circle-outline"
          label="Details"
          onPress={() =>
            router.push({
              pathname: '/exercise/[exerciseId]',
              params: { exerciseId: exercise.exerciseId },
            })
          }
        />
      </View>
      {howTo && info ? (
        <Card>
          {info.instructions.map((step, i) => (
            <View key={i} style={styles.step}>
              <ThemedText type="smallBold" themeColor="accent" style={styles.stepNumber}>
                {i + 1}
              </ThemedText>
              <ThemedText type="small" style={styles.flex}>
                {step}
              </ThemedText>
            </View>
          ))}
          {info.safetyTips.map((tip, i) => (
            <View key={`tip-${i}`} style={styles.step}>
              <Icon name="shield-checkmark-outline" size={18} color="warning" />
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                {tip}
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      <View style={styles.sets} accessibilityRole="tablist">
        {exercise.sets.map((s, i) => (
          <SetDot
            key={i}
            number={i + 1}
            done={s.done}
            selected={i === setIndex}
            onPress={() => live.pickSet(i)}
          />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add set"
          onPress={live.addSet}
          style={styles.dotWrap}>
          <Icon name="add" size={20} color="accent" />
        </Pressable>
      </View>

      {allDone && current < draft.exercises.length - 1 ? (
        <Button
          label="Next exercise"
          icon="chevron-forward"
          variant="secondary"
          onPress={() => go(upNext.exercise === current ? current + 1 : upNext.exercise)}
        />
      ) : null}
    </>
  );
}

/** Reps, kg and Done for the set in hand, pinned under the live view so it never scrolls away. */
export function LiveSetBar({ live }: { live: Live }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { exercise, setIndex, set, upNext, resting } = live;
  if (resting || !upNext) return null;
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          paddingBottom: Spacing.three + insets.bottom,
        },
      ]}>
      <View style={styles.barInner}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="label" themeColor="textSecondary">
              Set {setIndex + 1} · Reps
            </ThemedText>
            <Stepper
              label={`${exercise.name} set ${setIndex + 1} reps`}
              value={set.reps}
              min={0}
              max={200}
              onChange={(reps) => live.updateSet({ reps })}
            />
          </View>
          <View style={styles.flex}>
            <ThemedText type="label" themeColor="textSecondary">
              Weight
            </ThemedText>
            <Stepper
              label={`${exercise.name} set ${setIndex + 1} weight`}
              value={set.weightKg ?? 0}
              step={WEIGHT_STEP}
              min={0}
              max={500}
              format={(kg) => (kg === 0 ? 'BW' : `${kg} kg`)}
              onChange={(kg) => live.updateSet({ weightKg: kg === 0 ? null : kg })}
            />
          </View>
        </View>
        <Button
          label={
            set.done
              ? `Undo set ${setIndex + 1}`
              : `Done · set ${setIndex + 1} of ${exercise.sets.length}`
          }
          icon={set.done ? 'arrow-undo' : 'checkmark'}
          variant={set.done ? 'secondary' : 'primary'}
          onPress={live.doSet}
        />
      </View>
    </View>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <View style={styles.progress}>
      <ProgressBar value={total ? done / total : 0} />
      <ThemedText type="small" themeColor="textSecondary">
        {done} of {total} sets done
      </ThemedText>
    </View>
  );
}

function SetDot({
  number,
  done,
  selected,
  onPress,
}: {
  number: number;
  done: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={`Set ${number}${done ? ', done' : ''}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.dotWrap}>
      <View
        style={[
          styles.dot,
          {
            backgroundColor: done ? theme.primary : theme.backgroundSelected,
            borderColor: selected ? theme.accent : 'transparent',
          },
        ]}>
        {done ? (
          <Icon name="checkmark" size={18} color="onPrimary" />
        ) : (
          <ThemedText type="smallBold">{number}</ThemedText>
        )}
      </View>
    </Pressable>
  );
}

function NavButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.dotWrap}>
      <Icon name={icon} size={24} color={disabled ? 'border' : 'text'} />
    </Pressable>
  );
}

function LinkButton({
  icon,
  label,
  expanded,
  onPress,
}: {
  icon: 'chevron-up' | 'list-outline' | 'swap-horizontal' | 'information-circle-outline';
  label: string;
  expanded?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      style={styles.link}>
      <Icon name={icon} size={18} color="accent" />
      <ThemedText type="linkPrimary">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  progress: {
    gap: Spacing.one,
  },
  restCard: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepNumber: {
    width: 20,
  },
  sets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dotWrap: {
    minWidth: TapTarget,
    minHeight: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  barInner: {
    gap: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
