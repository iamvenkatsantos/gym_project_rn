import { SegmentedControl } from '@/components/segmented-control';
import { useAppearance, type AppearanceChoice } from '@/features/appearance/appearance-store';

const options: { value: AppearanceChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Light, dark, or match the phone (the default). */
export function AppearancePicker() {
  const choice = useAppearance((s) => s.choice);
  const setChoice = useAppearance((s) => s.setChoice);

  return <SegmentedControl options={options} value={choice} onChange={setChoice} />;
}
