import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Stepper } from '@/components/stepper';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PlanLimits } from '@/features/workouts/plan-draft';
import type { PlanExercise } from '@/features/workouts/types';
import { useTheme } from '@/hooks/use-theme';

type Patch = Partial<Pick<PlanExercise, 'sets' | 'reps' | 'targetWeightKg' | 'restSeconds'>>;

type PlanExerciseEditorProps = {
  exercise: PlanExercise;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Patch) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
};

function rest(seconds: number) {
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** One exercise in the plan builder: its prescription, and controls to reorder or remove it. */
export function PlanExerciseEditor({
  exercise,
  position,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
}: PlanExerciseEditorProps) {
  const theme = useTheme();

  const iconButton = (icon: IconName, label: string, onPress: () => void, disabled = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${exercise.name}`}
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

  const field = (label: string, stepper: ReactNode) => (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      {stepper}
    </View>
  );

  return (
    <Card>
      <View style={styles.header}>
        <ThemedText type="smallBold" themeColor="primary" style={styles.position}>
          {position}
        </ThemedText>
        <ThemedText type="heading" style={styles.name} numberOfLines={2}>
          {exercise.name}
        </ThemedText>
        {iconButton('chevron-up', 'Move up', () => onMove(-1), isFirst)}
        {iconButton('chevron-down', 'Move down', () => onMove(1), isLast)}
        {iconButton('trash-outline', 'Remove', onRemove)}
      </View>
      <View style={styles.grid}>
        {field(
          'Sets',
          <Stepper
            label={`${exercise.name} sets`}
            value={exercise.sets}
            {...PlanLimits.sets}
            onChange={(sets) => onChange({ sets })}
          />,
        )}
        {field(
          'Reps',
          <Stepper
            label={`${exercise.name} reps`}
            value={exercise.reps}
            {...PlanLimits.reps}
            onChange={(reps) => onChange({ reps })}
          />,
        )}
        {field(
          'Target',
          <Stepper
            label={`${exercise.name} target weight`}
            value={exercise.targetWeightKg ?? 0}
            step={2.5}
            {...PlanLimits.targetWeightKg}
            format={(kg) => (kg === 0 ? 'BW' : `${kg} kg`)}
            onChange={(kg) => onChange({ targetWeightKg: kg })}
          />,
        )}
        {field(
          'Rest',
          <Stepper
            label={`${exercise.name} rest`}
            value={exercise.restSeconds}
            step={15}
            {...PlanLimits.restSeconds}
            format={rest}
            onChange={(restSeconds) => onChange({ restSeconds })}
          />,
        )}
      </View>
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
  name: {
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  field: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: Spacing.one,
  },
});
