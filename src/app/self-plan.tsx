import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useTrainerLinks } from '@/features/coaching/hooks';
import { useSelfPlans, useSelfPrefs, useSelfWorkoutsOn } from '@/features/self-workouts/hooks';
import { prefsSummary } from '@/features/self-workouts/rules';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { daysLabel, isoWeekday, Weekdays } from '@/features/workouts/schedule';

/**
 * A member's own week (self workouts): pick a day to see its plan, edit any plan or add one.
 * The member edits while self workouts are on; their trainers can always edit.
 * Owners and supervisors look only. memberId defaults to the signed-in member.
 */
export default function SelfPlanScreen() {
  const params = useLocalSearchParams<{ memberId?: string; name?: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const memberId = params.memberId ?? profile.id;
  const isMember = memberId === profile.id;
  const { plans, ...query } = useSelfPlans(gym.gymId, memberId);
  const prefs = useSelfPrefs(gym.gymId, memberId);
  const self = useSelfWorkoutsOn(gym.gymId, memberId);
  const links = useTrainerLinks(gym.gymId, { memberId });
  const coaches = links.data?.some((l) => l.trainerId === profile.id) ?? false;
  const canEdit = coaches || (isMember && self.on === true);
  const [day, setDay] = useState(isoWeekday(new Date()));

  const dayPlans = (plans ?? []).filter((w) => (w.memberDays[memberId] ?? []).includes(day));

  return (
    <Screen>
      <Stack.Screen options={{ title: isMember ? 'My plan' : (params.name ?? 'Their plan') }} />
      {prefs.data ? (
        <ThemedText type="small" themeColor="textSecondary">
          {prefsSummary(prefs.data)}
        </ThemedText>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.days}>
        {Weekdays.map((w) => (
          <Chip
            key={w.day}
            label={w.short}
            selected={w.day === day}
            onPress={() => setDay(w.day)}
          />
        ))}
      </ScrollView>

      <QueryState query={query} isEmpty={() => false}>
        {() => (
          <>
            {dayPlans.length === 0 ? (
              <Card>
                <ThemedText type="heading">Rest day</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Sleep well and drink enough water.
                </ThemedText>
              </Card>
            ) : (
              dayPlans.map((w) => (
                <WorkoutCard
                  key={w.id}
                  workout={w}
                  action={
                    canEdit ? (
                      <Button
                        label="Edit"
                        icon="create-outline"
                        variant="secondary"
                        size="compact"
                        onPress={() =>
                          router.push({
                            pathname: '/plan-editor',
                            params: { memberId, workoutId: w.id },
                          })
                        }
                      />
                    ) : undefined
                  }
                />
              ))
            )}

            <SectionHeader title="All plans" detail={`${plans?.length ?? 0}`} />
            {(plans ?? []).length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No plans yet.
              </ThemedText>
            ) : (
              <Card>
                {(plans ?? []).map((w) => (
                  <View key={w.id} style={styles.row}>
                    <View style={styles.flex}>
                      <ThemedText type="smallBold">{w.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {daysLabel(w.memberDays[memberId] ?? [])} · {w.exercises.length} exercises
                      </ThemedText>
                    </View>
                    {canEdit ? (
                      <Button
                        label="Edit"
                        variant="secondary"
                        size="compact"
                        onPress={() =>
                          router.push({
                            pathname: '/plan-editor',
                            params: { memberId, workoutId: w.id },
                          })
                        }
                      />
                    ) : null}
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </QueryState>

      {canEdit ? (
        <Button
          label="Add a plan"
          icon="add"
          variant="secondary"
          onPress={() => router.push({ pathname: '/plan-editor', params: { memberId } })}
        />
      ) : null}
      {isMember && self.on ? (
        <Button
          label="Re-create my plan"
          icon="refresh"
          variant="secondary"
          onPress={() => router.push('/self-plan-setup')}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  days: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
