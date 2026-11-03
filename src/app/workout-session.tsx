import { router } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { MaxFontScale, Radius, Spacing, TapTarget } from '@/constants/theme';
import { ExerciseDemo } from '@/features/exercises/components/exercise-demo';
import { useExercises } from '@/features/exercises/hooks';
import type { Role } from '@/features/auth/types';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { offerCheckOut } from '@/features/check-in/offer-check-out';
import {
  type DraftExercise,
  type DraftSet,
  useWorkoutDraft,
  type WorkoutDraft,
} from '@/features/progress/draft-store';
import {
  LiveSetBar,
  LiveWorkout,
  useLiveWorkout,
} from '@/features/progress/components/live-workout';
import { useFinishWorkout } from '@/features/progress/hooks';
import type { SelfCheck } from '@/features/progress/types';
import { SelfCheckForm } from '@/features/self-workouts/components/self-check-form';
import { cleanSelfCheck, selfCheckProblem } from '@/features/self-workouts/rules';
import { PlanStretches } from '@/features/workouts/components/plan-stretches';
import { useExercisePicks } from '@/features/workouts/exercise-picks';
import { useTheme } from '@/hooks/use-theme';
import { validateDecimal, validateWholeNumber } from '@/lib/validation';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/** Where each role reads their own history after a workout. */
const historyRoute = {
  member: '/member/progress',
  trainer: '/trainer/training',
  supervisor: '/supervisor/training',
  owner: '/owner/training',
} as const satisfies Record<Role, string>;

/** Reps typed in a set: a whole number, or an error to show under the set. */
function parseReps(text: string): { value: number } | { error: string } {
  const error = validateWholeNumber(text, { min: 0, max: 200, label: 'number of reps' });
  return error ? { error } : { value: Number(text.trim()) };
}

/** Kilograms typed in a set; blank means bodyweight. */
function parseWeight(text: string): { value: number | null } | { error: string } {
  if (!text.trim()) return { value: null };
  const error = validateDecimal(text, { min: 0, max: 500, label: 'weight in kg' });
  return error ? { error } : { value: Number(text.trim().replace(',', '.')) };
}

const emptyCheck: SelfCheck = { effort: null, pain: null, note: null };

type View_ = 'live' | 'list';

export default function WorkoutSessionScreen() {
  const draft = useWorkoutDraft((s) => s.draft);
  if (!draft) {
    return (
      <Screen refreshable={false}>
        <ThemedText themeColor="textSecondary">No workout in progress.</ThemedText>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }
  return <ActiveSession draft={draft} />;
}

function ActiveSession({ draft }: { draft: WorkoutDraft }) {
  const theme = useTheme();
  const profile = useProfile();
  const gym = useActiveGym();
  const { restUntil, toggleSet, updateSet, addSet, skipRest, discard } = useWorkoutDraft();
  const replaceExercise = useWorkoutDraft((s) => s.replaceExercise);
  const setSelfCheck = useWorkoutDraft((s) => s.setSelfCheck);
  const openPicks = useExercisePicks((s) => s.open);
  const library = useExercises(gym.gymId);
  const finish = useFinishWorkout(profile.id);
  const isMember = gym.role === 'member';
  const [view, setView] = useState<View_>('live');
  const [focus, setFocus] = useState(0);
  const [showCheckProblem, setShowCheckProblem] = useState(false);
  const now = useNow();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [openDemo, setOpenDemo] = useState<string | null>(null);
  // A bad reps or weight entry keeps the set's last good value and says why.
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const setInputError = (ei: number, si: number, error: string | null) =>
    setInputErrors((errors) => {
      const { [`${ei}-${si}`]: _, ...rest } = errors;
      return error ? { ...rest, [`${ei}-${si}`]: error } : rest;
    });

  const live = useLiveWorkout(draft, focus, setFocus, now);
  const showLive = view === 'live' && draft.exercises.length > 0;

  const doneSets = draft.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const totalSets = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
  const resting = restUntil !== null && restUntil > now;

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
  ];

  const check = draft.selfCheck ?? emptyCheck;
  const checkProblem = isMember ? selfCheckProblem(check) : null;

  // Machine busy? Pick another exercise for the same muscle; sets and reps stay.
  const replace = (ei: number) => {
    const muscle =
      library.data?.find((e) => e.id === draft.exercises[ei].exerciseId)?.muscleGroups[0] ?? null;
    openPicks(
      draft.exercises.map((e) => e.exerciseId),
      (picked) => replaceExercise(ei, picked),
      { single: true, muscle },
    );
    router.push('/add-exercises');
  };
  const renderExercise = (exercise: DraftExercise, ei: number) => (
    <Card key={exercise.exerciseId}>
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          router.push({
            pathname: '/exercise/[exerciseId]',
            params: { exerciseId: exercise.exerciseId },
          })
        }
        style={styles.exerciseHeader}>
        <ExerciseDemo
          exerciseId={exercise.exerciseId}
          name={exercise.name}
          variant="thumb"
          animate
        />
        <ThemedText type="heading" style={styles.flex}>
          {exercise.name}
        </ThemedText>
        <Icon name="information-circle-outline" size={20} />
      </Pressable>
      <View style={styles.links}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: openDemo === exercise.exerciseId }}
          onPress={() =>
            setOpenDemo((id) => (id === exercise.exerciseId ? null : exercise.exerciseId))
          }
          style={styles.addSet}>
          <Icon
            name={openDemo === exercise.exerciseId ? 'chevron-up' : 'play-circle-outline'}
            size={18}
            color="accent"
          />
          <ThemedText type="linkPrimary">
            {openDemo === exercise.exerciseId ? 'Hide demo' : 'Show demo'}
          </ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Replace ${exercise.name}`}
          onPress={() => replace(ei)}
          style={styles.addSet}>
          <Icon name="swap-horizontal" size={18} color="accent" />
          <ThemedText type="linkPrimary">Replace</ThemedText>
        </Pressable>
      </View>
      {openDemo === exercise.exerciseId ? (
        <ExerciseDemo exerciseId={exercise.exerciseId} name={exercise.name} />
      ) : null}

      <View style={styles.setRow}>
        <ThemedText type="label" themeColor="textSecondary" style={styles.setNumber}>
          Set
        </ThemedText>
        <ThemedText type="label" themeColor="textSecondary" style={[styles.flex, styles.center]}>
          Reps
        </ThemedText>
        <ThemedText type="label" themeColor="textSecondary" style={[styles.flex, styles.center]}>
          kg
        </ThemedText>
        <View style={styles.check} />
      </View>
      {exercise.sets.map((set: DraftSet, si) => (
        <Fragment key={si}>
          <View style={styles.setRow}>
            <ThemedText type="smallBold" style={styles.setNumber}>
              {si + 1}
            </ThemedText>
            <TextInput
              maxFontSizeMultiplier={MaxFontScale}
              accessibilityLabel={`${exercise.name} set ${si + 1} reps`}
              keyboardType="number-pad"
              style={[inputStyle, styles.flex]}
              defaultValue={String(set.reps)}
              onEndEditing={(e) => {
                const parsed = parseReps(e.nativeEvent.text);
                setInputError(ei, si, 'error' in parsed ? parsed.error : null);
                if ('value' in parsed) updateSet(ei, si, { reps: parsed.value });
              }}
            />
            <TextInput
              maxFontSizeMultiplier={MaxFontScale}
              accessibilityLabel={`${exercise.name} set ${si + 1} weight in kg`}
              keyboardType="decimal-pad"
              placeholder="BW"
              placeholderTextColor={theme.textSecondary}
              style={[inputStyle, styles.flex]}
              defaultValue={set.weightKg === null ? '' : String(set.weightKg)}
              onEndEditing={(e) => {
                const parsed = parseWeight(e.nativeEvent.text);
                setInputError(ei, si, 'error' in parsed ? parsed.error : null);
                if ('value' in parsed) updateSet(ei, si, { weightKg: parsed.value });
              }}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: set.done }}
              accessibilityLabel={`${exercise.name} set ${si + 1} done`}
              onPress={() => toggleSet(ei, si)}
              style={[
                styles.check,
                {
                  backgroundColor: set.done ? theme.primary : theme.backgroundSelected,
                },
              ]}>
              <Icon name="checkmark" size={22} color={set.done ? 'onPrimary' : 'textSecondary'} />
            </Pressable>
          </View>
          {inputErrors[`${ei}-${si}`] ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              Set {si + 1}: {inputErrors[`${ei}-${si}`]}
            </ThemedText>
          ) : null}
        </Fragment>
      ))}
      <Pressable accessibilityRole="button" onPress={() => addSet(ei)} style={styles.addSet}>
        <Icon name="add" size={18} color="accent" />
        <ThemedText type="linkPrimary">Add set</ThemedText>
      </Pressable>
    </Card>
  );

  return (
    <View style={styles.root}>
      <Screen refreshable={false}>
        <View>
          <ThemedText type="title">{draft.title}</ThemedText>
          <View style={styles.elapsed}>
            <Icon name="time-outline" size={16} color="textSecondary" />
            <ThemedText type="small" themeColor="textSecondary">
              Workout time {clock(now - new Date(draft.startedAt).getTime())}
            </ThemedText>
          </View>
          {view === 'list' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {doneSets} of {totalSets} sets done
            </ThemedText>
          ) : null}
        </View>

        {draft.exercises.length > 0 ? (
          <SegmentedControl<View_>
            options={[
              { value: 'live', label: 'Live' },
              { value: 'list', label: 'All exercises' },
            ]}
            value={view}
            onChange={setView}
          />
        ) : null}

        {showLive ? (
          <LiveWorkout live={live} library={library.data} onReplace={replace} />
        ) : (
          <>
            {resting ? (
              <Card highlighted style={styles.rest}>
                <Icon name="timer-outline" size={28} color="accent" />
                <View style={styles.flex}>
                  <ThemedText type="label" themeColor="textSecondary">
                    Rest
                  </ThemedText>
                  <ThemedText type="title" themeColor="accent">
                    {clock(restUntil - now)}
                  </ThemedText>
                </View>
                <Button label="Skip" variant="secondary" size="compact" onPress={skipRest} />
              </Card>
            ) : null}
            {draft.exercises.map(renderExercise)}
          </>
        )}

        {showLive ? null : (
          <Card>
            <PlanStretches items={draft.exercises} />
          </Card>
        )}

        {isMember && doneSets > 0 ? (
          <SelfCheckForm
            value={check}
            onChange={setSelfCheck}
            showProblem={showCheckProblem}
            problem={checkProblem}
          />
        ) : null}
        <Button
          label={finish.isError ? 'Retry saving workout' : 'Finish workout'}
          icon="flag-outline"
          disabled={doneSets === 0}
          loading={finish.isPending}
          onPress={() => {
            if (checkProblem) {
              setShowCheckProblem(true);
              return;
            }
            if (isMember) setSelfCheck(cleanSelfCheck(check));
            finish.mutate(undefined, {
              onSuccess: () => {
                router.replace(historyRoute[gym.role]);
                if (gym.role === 'member') offerCheckOut(gym.gymId, profile.id);
              },
            });
          }}
        />
        {finish.error ? (
          <ThemedText themeColor="danger">
            Couldn&apos;t save: {finish.error.message}. Your workout is kept on this phone, so you
            can retry when you&apos;re back online.
          </ThemedText>
        ) : null}
        {confirmDiscard ? (
          <Card>
            <ThemedText type="smallBold">Discard this workout?</ThemedText>
            <View style={styles.setRow}>
              <View style={styles.flex}>
                <Button
                  label="Keep going"
                  variant="secondary"
                  size="compact"
                  onPress={() => setConfirmDiscard(false)}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Discard"
                  variant="danger"
                  size="compact"
                  onPress={() => {
                    discard();
                    router.back();
                  }}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Button
            label="Discard workout"
            variant="danger"
            size="compact"
            onPress={() => setConfirmDiscard(true)}
          />
        )}
      </Screen>
      {showLive ? <LiveSetBar live={live} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  elapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  rest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 32,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  setNumber: {
    width: 32,
    textAlign: 'center',
  },
  input: {
    // Without this, web TextInputs keep their intrinsic width and overflow the row.
    minWidth: 0,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    fontSize: 16,
    textAlign: 'center',
  },
  check: {
    width: TapTarget - 8,
    height: 44,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
});
