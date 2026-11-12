import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** "Share my history": lets a gym's coaches see what the person logged at their other gyms. */
export function ShareHistorySwitch({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <ThemedText type="label">Share my history</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Coaches here see your workouts and progress from other gyms.
        </ThemedText>
      </View>
      <Switch
        accessibilityLabel="Share my history"
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: theme.primary, false: theme.border }}
        thumbColor={theme.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: TapTarget,
  },
  text: {
    flex: 1,
  },
});
