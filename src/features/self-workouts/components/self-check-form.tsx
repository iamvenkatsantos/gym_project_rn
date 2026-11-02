import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import type { SelfCheck } from '@/features/progress/types';
import { effortLabel, NOTE_MAX, PAIN_MAX, painSpots } from '@/features/self-workouts/rules';
import { useTheme } from '@/hooks/use-theme';

const efforts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * How the workout went, answered before finishing: effort 1 to 10 (required), any pain,
 * and a note. It goes to the member's trainers with the workout.
 */
export function SelfCheckForm({
  value,
  onChange,
  showProblem,
  problem,
}: {
  value: SelfCheck;
  onChange: (check: SelfCheck) => void;
  showProblem: boolean;
  problem: string | null;
}) {
  const theme = useTheme();
  const [hurt, setHurt] = useState(value.pain !== null);

  return (
    <Card>
      <ThemedText type="heading">How did it go?</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Your trainer sees this.
      </ThemedText>

      <ThemedText type="label" themeColor="textSecondary">
        Effort{value.effort ? `: ${effortLabel(value.effort)}` : ''}
      </ThemedText>
      <View style={styles.efforts}>
        {efforts.map((n) => {
          const selected = value.effort === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityLabel={`Effort ${n} of 10, ${effortLabel(n)}`}
              accessibilityState={{ selected }}
              onPress={() => onChange({ ...value, effort: n })}
              style={({ pressed }) => [
                styles.effort,
                {
                  backgroundColor: selected ? theme.primary : theme.backgroundElement,
                  borderColor: selected ? theme.primary : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText
                type="smallBold"
                themeColor={selected ? 'onPrimary' : 'text'}
                maxFontSizeMultiplier={1.2}>
                {n}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="label" themeColor="textSecondary">
        Any pain?
      </ThemedText>
      <View style={styles.chips}>
        <Chip
          label="No"
          selected={!hurt}
          onPress={() => {
            setHurt(false);
            onChange({ ...value, pain: null });
          }}
        />
        {painSpots.map((spot) => (
          <Chip
            key={spot}
            label={spot}
            selected={hurt && value.pain === spot}
            onPress={() => {
              setHurt(true);
              onChange({ ...value, pain: spot });
            }}
          />
        ))}
        <Chip
          label="Other"
          selected={hurt && value.pain !== null && !painSpots.includes(value.pain)}
          onPress={() => {
            setHurt(true);
            onChange({ ...value, pain: '' });
          }}
        />
      </View>
      {hurt && value.pain !== null && !painSpots.includes(value.pain) ? (
        <TextField
          label="Where did it hurt?"
          value={value.pain}
          onChangeText={(pain) => onChange({ ...value, pain })}
          maxLength={PAIN_MAX}
        />
      ) : null}

      <TextField
        label="Note (optional)"
        placeholder="e.g. Felt strong, add weight next time"
        value={value.note ?? ''}
        onChangeText={(note) => onChange({ ...value, note })}
        multiline
        maxLength={NOTE_MAX}
      />
      {showProblem && problem ? (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {problem}
        </ThemedText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  efforts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  effort: {
    // Five a row at 360px, all ten in one row on wider screens.
    width: TapTarget,
    height: TapTarget,
    borderRadius: Radius.small,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
