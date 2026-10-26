import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Pill, type PillTone } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { foodTypeLabel } from '@/features/diet/plan-draft';
import type { FoodType, MealPlan } from '@/features/diet/types';
import { useTheme } from '@/hooks/use-theme';

const foodTypeStyle: Record<FoodType, { tone: PillTone; icon: IconName }> = {
  veg: { tone: 'success', icon: 'leaf-outline' },
  vegan: { tone: 'success', icon: 'leaf-outline' },
  egg: { tone: 'warning', icon: 'egg-outline' },
  non_veg: { tone: 'danger', icon: 'fish-outline' },
};

export function FoodTypePill({ type }: { type: FoodType }) {
  return <Pill label={foodTypeLabel(type)} {...foodTypeStyle[type]} />;
}

/** "2300 kcal · P 120 g · C 280 g · F 70 g", leaving out targets the coach didn't set. */
export function targetsSummary({ targets }: Pick<MealPlan, 'targets'>) {
  return [
    targets.calories !== null ? `${targets.calories} kcal` : null,
    targets.proteinG !== null ? `P ${targets.proteinG} g` : null,
    targets.carbsG !== null ? `C ${targets.carbsG} g` : null,
    targets.fatG !== null ? `F ${targets.fatG} g` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A diet plan at a glance, for a coach's list. */
export function MealPlanCard({ plan, action }: { plan: MealPlan; action?: ReactNode }) {
  const theme = useTheme();
  const summary = targetsSummary(plan);

  return (
    <Card>
      <FoodTypePill type={plan.foodType} />
      <ThemedText type="heading">{plan.title}</ThemedText>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Icon name="restaurant-outline" size={16} />
          <ThemedText type="small" themeColor="textSecondary">
            {plan.meals.length} {plan.meals.length === 1 ? 'meal' : 'meals'}
          </ThemedText>
        </View>
        {summary ? (
          <View style={styles.metaItem}>
            <Icon name="flame-outline" size={16} />
            <ThemedText type="small" themeColor="textSecondary">
              {summary}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={[styles.meals, { borderTopColor: theme.border }]}>
        {plan.meals.map((meal, i) => (
          <View key={i} style={styles.meal}>
            <ThemedText type="smallBold" style={styles.mealName}>
              {meal.name}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
              style={styles.flex}>
              {meal.foods}
            </ThemedText>
          </View>
        ))}
      </View>
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  meals: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    marginTop: Spacing.one,
    gap: Spacing.one,
  },
  meal: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  mealName: {
    width: 110,
  },
  flex: {
    flex: 1,
  },
});
