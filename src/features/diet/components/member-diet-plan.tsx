import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { FoodTypePill } from '@/features/diet/components/meal-plan-card';
import { useMemberMealPlan } from '@/features/diet/hooks';
import { macroCalories, mealsCalories } from '@/features/diet/plan-draft';
import type { MealPlan } from '@/features/diet/types';
import { useTheme } from '@/hooks/use-theme';

/** The diet plan a member's coach gave them, meal by meal. */
export function MemberDietPlan({ gymId, memberId }: { gymId: string; memberId: string }) {
  const plan = useMemberMealPlan(gymId, memberId);

  return (
    <QueryState query={plan}>
      {(data) => (data ? <DietPlanDetails plan={data} /> : <NoDietPlan />)}
    </QueryState>
  );
}

function NoDietPlan() {
  return (
    <Card>
      <Icon name="nutrition-outline" size={28} color="accent" />
      <ThemedText type="heading">No diet plan yet</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Your trainer can write a meal plan for your goals, with what to eat and when. Ask them at
        the gym; it shows up here once they assign it.
      </ThemedText>
    </Card>
  );
}

export function DietPlanDetails({ plan }: { plan: MealPlan }) {
  const theme = useTheme();
  const { targets } = plan;
  const calories = targets.calories ?? macroCalories(targets) ?? mealsCalories(plan.meals);
  const hasMacros = targets.proteinG !== null || targets.carbsG !== null || targets.fatG !== null;

  return (
    <>
      <Card highlighted>
        <FoodTypePill type={plan.foodType} />
        <ThemedText type="title">{plan.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          From {plan.coachName} · updated{' '}
          {new Date(plan.updatedAt).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
          })}
        </ThemedText>
      </Card>

      {calories !== null || hasMacros ? (
        <>
          <SectionHeader title="Daily targets" />
          <View style={styles.tiles}>
            <StatTile
              label="kcal a day"
              value={calories ?? undefined}
              icon="flame-outline"
              accent
            />
          </View>
          {hasMacros ? (
            <View style={styles.tiles}>
              <StatTile
                compact
                label="Protein (g)"
                value={targets.proteinG ?? undefined}
                icon="barbell-outline"
              />
              <StatTile
                compact
                label="Carbs (g)"
                value={targets.carbsG ?? undefined}
                icon="leaf-outline"
              />
              <StatTile
                compact
                label="Fat (g)"
                value={targets.fatG ?? undefined}
                icon="water-outline"
              />
            </View>
          ) : null}
        </>
      ) : null}

      <SectionHeader title="Meals" detail={`${plan.meals.length} a day`} />
      {plan.meals.map((meal, i) => (
        <Card key={i}>
          <View style={styles.mealHeader}>
            <View style={[styles.mealIcon, { backgroundColor: withAlpha(theme.accent, 0.12) }]}>
              <Icon name="restaurant-outline" size={18} color="accent" />
            </View>
            <View style={styles.flex}>
              <ThemedText type="heading">{meal.name}</ThemedText>
              {meal.time ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {meal.time}
                </ThemedText>
              ) : null}
            </View>
            {meal.calories !== null ? (
              <ThemedText type="smallBold" themeColor="accent">
                {meal.calories} kcal
              </ThemedText>
            ) : null}
          </View>
          <ThemedText>{meal.foods}</ThemedText>
        </Card>
      ))}

      {plan.notes ? (
        <>
          <SectionHeader title="Notes from your trainer" />
          <Card>
            <ThemedText>{plan.notes}</ThemedText>
          </Card>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  mealIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
});
