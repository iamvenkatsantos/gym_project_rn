import { StyleSheet, View } from 'react-native';

import { SegmentedControl } from '@/components/segmented-control';
import { Spacing } from '@/constants/theme';
import { useAppearance, type AppearanceChoice } from '@/features/appearance/appearance-store';

import { ThemeColorPicker } from './theme-color-picker';

const options: { value: AppearanceChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Light, dark, or match the phone (the default), and the theme colour. */
export function AppearancePicker() {
  const choice = useAppearance((s) => s.choice);
  const setChoice = useAppearance((s) => s.setChoice);

  return (
    <View style={styles.stack}>
      <SegmentedControl options={options} value={choice} onChange={setChoice} />
      <ThemeColorPicker />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.three },
});
