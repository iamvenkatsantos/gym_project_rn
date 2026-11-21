import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  getPalette,
  Spacing,
  TapTarget,
  ThemeColorLabels,
  ThemeColors,
  type ThemeColorId,
} from '@/constants/theme';
import { useColorSchemeName, useTheme } from '@/hooks/use-theme';
import { useT } from '@/i18n';

const SWATCH = 40;

/** A row of colour swatches; the picked one gets a ring and a tick. */
export function ThemeColorPicker({
  value,
  onChange,
  disabled,
}: {
  value: ThemeColorId;
  onChange: (color: ThemeColorId) => void;
  disabled?: boolean;
}) {
  const scheme = useColorSchemeName();
  const theme = useTheme();
  const t = useT();

  return (
    <View accessibilityRole="radiogroup" style={styles.row}>
      {ThemeColors.map((id: ThemeColorId) => {
        const selected = id === value;
        const swatch = getPalette(scheme, id);
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={t(`${ThemeColorLabels[id]} theme`)}
            disabled={disabled}
            onPress={() => onChange(id)}
            style={styles.item}>
            <View style={[styles.ring, { borderColor: selected ? swatch.accent : 'transparent' }]}>
              <View style={[styles.swatch, { backgroundColor: swatch.primary }]}>
                {selected ? <Ionicons name="checkmark" size={22} color={swatch.onPrimary} /> : null}
              </View>
            </View>
            <ThemedText
              type={selected ? 'smallBold' : 'small'}
              style={{ color: selected ? theme.text : theme.textSecondary }}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}>
              {ThemeColorLabels[id]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.one,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: TapTarget,
  },
  ring: {
    borderWidth: 2,
    borderRadius: 999,
    padding: 3,
  },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
