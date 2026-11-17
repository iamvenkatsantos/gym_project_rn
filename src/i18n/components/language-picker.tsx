import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/chip';
import { SegmentedControl } from '@/components/segmented-control';
import { Spacing } from '@/constants/theme';
import { LANGUAGES, useLanguage, useLanguageStore, type Language } from '@/i18n';

const options = LANGUAGES.map((l) => ({ value: l.code, label: l.nativeName }));

/**
 * English, Tamil or Hindi, each in its own script. Kept on the phone. `compact` is a row of
 * chips for the sign-in screen.
 */
export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const language = useLanguage();
  const setLanguage = useLanguageStore((s) => s.setLanguage);

  if (!compact) {
    return <SegmentedControl<Language> options={options} value={language} onChange={setLanguage} />;
  }
  return (
    <View style={styles.row} accessibilityLabel="Language">
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          selected={o.value === language}
          onPress={() => setLanguage(o.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
