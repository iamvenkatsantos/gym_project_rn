import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { initials } from '@/features/trainers/rules';
import { useTheme } from '@/hooks/use-theme';

/** A person with a checkbox, for picking trainers or members before saving. */
export function PickRow({
  name,
  detail,
  warn,
  checked,
  divider,
  onPress,
}: {
  name: string;
  detail?: string;
  /** Shows the detail in the warning colour, e.g. "No trainer yet". */
  warn?: boolean;
  checked: boolean;
  divider: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={detail ? `${name}, ${detail}` : name}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{initials(name)}</ThemedText>
      </View>
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {name}
        </ThemedText>
        {detail ? (
          <ThemedText
            type="small"
            themeColor={warn ? 'warning' : 'textSecondary'}
            numberOfLines={2}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      <View
        style={[
          styles.check,
          checked
            ? { backgroundColor: theme.primary }
            : { borderColor: theme.border, borderWidth: 2 },
        ]}>
        {checked ? <Icon name="checkmark" size={18} color="onPrimary" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: TapTarget + 8,
    paddingVertical: Spacing.one,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
