import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { WorkoutCard } from '@/features/workouts/components/workout-card';
import { useWorkouts } from '@/features/workouts/hooks';

/** The plans a coach wrote, with shortcuts to edit and assign them. */
export function MyPlans() {
  const profile = useProfile();
  const gym = useActiveGym();
  const workouts = useWorkouts(gym.gymId, profile.id);

  return (
    <>
      <Button label="New plan" icon="add" onPress={() => router.push('/plan-editor')} />
      <QueryState
        query={workouts}
        isEmpty={(w) => w.length === 0}
        emptyText="You haven't created any plans yet.">
        {(list) =>
          list.map((workout) => {
            const assigned = workout.assignedMemberIds.length;
            return (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                action={
                  <View style={styles.actions}>
                    <View style={styles.flex}>
                      <Button
                        label="Edit"
                        icon="create-outline"
                        variant="secondary"
                        size="compact"
                        onPress={() =>
                          router.push({
                            pathname: '/plan-editor',
                            params: { workoutId: workout.id },
                          })
                        }
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        label={assigned ? `Assigned · ${assigned}` : 'Assign'}
                        icon="people-outline"
                        size="compact"
                        onPress={() =>
                          router.push({
                            pathname: '/assign-plan/[workoutId]',
                            params: { workoutId: workout.id },
                          })
                        }
                      />
                    </View>
                  </View>
                }
              />
            );
          })
        }
      </QueryState>
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
