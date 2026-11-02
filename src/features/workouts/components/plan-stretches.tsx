import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing, TapTarget } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { useExercises } from '@/features/exercises/hooks';
import { starterExercises } from '@/features/exercises/library';
import { holdLabel, stretchesFor } from '@/features/workouts/stretches';
import { useTheme } from '@/hooks/use-theme';

type Item = { exerciseId: string; name: string };

/** The muscles a plan works, from the gym's exercises (or the shared library by name). */
function useMuscles(items: readonly Item[]) {
  const gym = useActiveGym();
  const exercises = useExercises(gym.gymId);
  const list = exercises.data ?? starterExercises;
  return items.flatMap((item) => {
    const match =
      list.find((e) => e.id === item.exerciseId) ??
      list.find((e) => e.name.toLowerCase() === item.name.toLowerCase());
    return match?.muscleGroups ?? [];
  });
}

function StretchList({ items }: { items: readonly Item[] }) {
  const theme = useTheme();
  const picked = stretchesFor(useMuscles(items));
  if (picked.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        No stretches for these exercises.
      </ThemedText>
    );
  }
  return (
    <View style={styles.list}>
      {picked.map((stretch) => (
        <View key={stretch.id} style={[styles.item, { borderTopColor: theme.border }]}>
          <View style={styles.itemHeader}>
            <ThemedText type="smallBold" style={styles.flex}>
              {stretch.name}
            </ThemedText>
            <ThemedText type="small" themeColor="accent">
              {holdLabel(stretch)}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {stretch.cue}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/** Cool-down stretches for a plan's exercises, shown on tap. */
export function PlanStretches({
  items,
  initiallyOpen = false,
}: {
  items: readonly Item[];
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  if (items.length === 0) return null;
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
        <Icon name="body-outline" size={18} color="accent" />
        <ThemedText type="linkPrimary" style={styles.flex}>
          {open ? 'Hide stretches' : 'Cool-down stretches'}
        </ThemedText>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color="accent" />
      </Pressable>
      {open ? <StretchList items={items} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TapTarget - 8,
  },
  pressed: {
    opacity: 0.6,
  },
  flex: {
    flex: 1,
  },
  list: {
    gap: Spacing.two,
  },
  item: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    gap: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
