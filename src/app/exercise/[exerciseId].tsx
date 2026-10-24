import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { difficultyTone } from '@/features/exercises/components/exercise-card';
import { useExercise } from '@/features/exercises/hooks';

export default function ExerciseScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const gym = useActiveGym();
  const { exercise, isPending } = useExercise(gym.gymId, exerciseId);

  if (!exercise) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          {isPending ? 'Loading…' : 'Exercise not found.'}
        </ThemedText>
      </Screen>
    );
  }

  return (
    <Screen title={exercise.name}>
      <Stack.Screen options={{ title: '' }} />
      <View style={styles.pills}>
        <Pill label={exercise.difficulty} tone={difficultyTone[exercise.difficulty]} />
        <Pill label={exercise.equipment === 'none' ? 'No equipment' : exercise.equipment} />
        {exercise.muscleGroups.map((m) => (
          <Pill key={m} label={m} tone="accent" />
        ))}
      </View>

      {/* Media slot: licensed or original images/videos per the plan's workout-media decision. */}
      <Card style={styles.media}>
        <Icon name={exercise.videoUrl ? 'play-circle' : 'image-outline'} size={40} />
        <ThemedText type="small" themeColor="textSecondary">
          {exercise.videoUrl ? 'Watch demonstration' : 'Demonstration coming soon'}
        </ThemedText>
      </Card>

      <SectionHeader title="How to do it" />
      <Card>
        {exercise.instructions.map((step, i) => (
          <View key={step} style={styles.step}>
            <ThemedText type="smallBold" themeColor="primary" style={styles.stepNumber}>
              {i + 1}
            </ThemedText>
            <ThemedText type="small" style={styles.flex}>
              {step}
            </ThemedText>
          </View>
        ))}
      </Card>

      {exercise.safetyTips.length ? (
        <>
          <SectionHeader title="Safety" />
          <Card>
            {exercise.safetyTips.map((tip) => (
              <View key={tip} style={styles.step}>
                <Icon name="shield-checkmark-outline" size={18} color="warning" />
                <ThemedText type="small" style={styles.flex}>
                  {tip}
                </ThemedText>
              </View>
            ))}
          </Card>
        </>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        General guidance only, not medical advice. Ask a trainer if anything hurts.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  media: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 16,
  },
  flex: {
    flex: 1,
  },
});
