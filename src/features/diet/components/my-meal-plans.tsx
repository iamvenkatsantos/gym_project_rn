import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { QueryState } from '@/components/query-state';
import { Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { MealPlanCard } from '@/features/diet/components/meal-plan-card';
import { useMealPlans } from '@/features/diet/hooks';

/** The diet plans a coach wrote, with shortcuts to edit and assign them. */
export function MyMealPlans() {
  const profile = useProfile();
  const gym = useActiveGym();
  const plans = useMealPlans(gym.gymId, profile.id);

  return (
    <>
      <Button label="New diet plan" icon="add" onPress={() => router.push('/meal-plan-editor')} />
      <QueryState
        query={plans}
        isEmpty={(p) => p.length === 0}
        emptyText="You haven't written any diet plans yet.">
        {(list) =>
          list.map((plan) => {
            const assigned = plan.assignedMemberIds.length;
            return (
              <MealPlanCard
                key={plan.id}
                plan={plan}
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
                            pathname: '/meal-plan-editor',
                            params: { planId: plan.id },
                          })
                        }
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        label={assigned ? `${assigned} assigned` : 'Assign'}
                        icon="people-outline"
                        size="compact"
                        onPress={() =>
                          router.push({
                            pathname: '/assign-meal-plan/[planId]',
                            params: { planId: plan.id },
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
