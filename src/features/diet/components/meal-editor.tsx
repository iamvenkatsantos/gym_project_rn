import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DietLimits, numberProblem, type MealDraft } from '@/features/diet/plan-draft';
import { useTheme } from '@/hooks/use-theme';

type MealEditorProps = {
  meal: MealDraft;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  /** Show every field's error, e.g. after the coach tried to save. */
  showErrors: boolean;
  onChange: (patch: Partial<Omit<MealDraft, 'key'>>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
};

/** One meal in the diet plan builder: what to eat and when, and controls to reorder or remove it. */
export function MealEditor({
  meal,
  position,
  isFirst,
  isLast,
  showErrors,
  onChange,
  onMove,
  onRemove,
}: MealEditorProps) {
  const theme = useTheme();
  const label = meal.name.trim() || `meal ${position}`;

  const iconButton = (icon: IconName, action: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action} ${label}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={18} color={disabled ? 'border' : 'text'} />
    </Pressable>
  );

  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="smallBold" themeColor="accent" style={styles.position}>
          {position}
        </ThemedText>
        <ThemedText type="heading" style={styles.flex} numberOfLines={1}>
          {meal.name.trim() || 'New meal'}
        </ThemedText>
        {iconButton('chevron-up', 'Move up', () => onMove(-1), isFirst)}
        {iconButton('chevron-down', 'Move down', () => onMove(1), isLast)}
        {iconButton('trash-outline', 'Remove', onRemove)}
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Meal"
            placeholder="e.g. Breakfast"
            value={meal.name}
            onChangeText={(name) => onChange({ name })}
            maxLength={DietLimits.mealName}
            error={meal.name.trim() ? null : 'Name this meal.'}
            showError={showErrors}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="When"
            placeholder="e.g. 7:30 AM"
            value={meal.time}
            onChangeText={(time) => onChange({ time })}
            maxLength={DietLimits.mealTime}
          />
        </View>
      </View>
      <TextField
        label="What to eat"
        placeholder="Foods and amounts, e.g. 2 rotis, 1 cup dal, salad"
        value={meal.foods}
        onChangeText={(foods) => onChange({ foods })}
        multiline
        maxLength={DietLimits.foods}
        error={meal.foods.trim() ? null : 'Add what to eat.'}
        showError={showErrors}
      />
      <TextField
        label="Calories (optional)"
        placeholder="kcal"
        value={meal.calories}
        onChangeText={(calories) => onChange({ calories })}
        keyboardType="number-pad"
        maxLength={4}
        error={numberProblem(meal.calories, DietLimits.mealCalories)}
        showError={showErrors}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  position: {
    width: 20,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
