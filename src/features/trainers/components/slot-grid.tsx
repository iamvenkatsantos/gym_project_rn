import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { Slot } from '@/features/trainers/rules';
import { useTheme } from '@/hooks/use-theme';
import { formatTime } from '@/lib/format';

type SlotGridProps = {
  slots: Slot[];
  selected: string | null;
  onSelect: (startsAt: string) => void;
};

export function SlotGrid({ slots, selected, onSelect }: SlotGridProps) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {slots.map((slot) => {
        const active = slot.startsAt === selected;
        return (
          <Pressable
            key={slot.startsAt}
            accessibilityRole="button"
            accessibilityLabel={`${formatTime(slot.startsAt)}${slot.available ? '' : ', unavailable'}`}
            accessibilityState={{ selected: active, disabled: !slot.available }}
            disabled={!slot.available}
            onPress={() => onSelect(slot.startsAt)}
            style={[
              styles.slot,
              {
                backgroundColor: active ? theme.primary : theme.backgroundElement,
                borderColor: active ? theme.primary : theme.border,
              },
              !slot.available && styles.unavailable,
            ]}>
            <ThemedText
              type="smallBold"
              themeColor={active ? 'onPrimary' : slot.available ? 'text' : 'textSecondary'}
              style={!slot.available && styles.struck}>
              {formatTime(slot.startsAt)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  slot: {
    minHeight: 48,
    minWidth: 100,
    flexGrow: 1,
    flexBasis: '30%',
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailable: {
    opacity: 0.4,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
});
