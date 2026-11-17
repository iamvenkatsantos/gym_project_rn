import {
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { Fonts, MaxFontScale, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { translateTo, useLanguage } from '@/i18n';
import { translateChildren } from '@/i18n/children';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'display'
    | 'title'
    | 'heading'
    | 'label'
    | 'small'
    | 'smallBold'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
  /** Off for text that must stay as typed, like names and codes. On by default. */
  translate?: boolean;
};

export function ThemedText({
  style,
  type = 'default',
  themeColor,
  maxFontSizeMultiplier = MaxFontScale,
  translate = true,
  children,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  const language = useLanguage();
  const english = language === 'en';

  const color = theme[themeColor ?? (type === 'linkPrimary' ? 'accent' : 'text')];

  return (
    <Text
      style={[{ color }, styles[type], style, !english && scriptStyle(styles[type], style)]}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}>
      {english || !translate
        ? children
        : translateChildren(children, (s) => translateTo(language, s))}
    </Text>
  );
}

/**
 * Tamil and Devanagari letters reach further above and below the line than Latin, so give
 * them more line height, and drop letter spacing, which breaks up joined letters.
 */
function scriptStyle(base: TextStyle, style: StyleProp<TextStyle>): TextStyle {
  const flat = { ...base, ...StyleSheet.flatten(style) };
  return {
    ...(flat.lineHeight ? { lineHeight: Math.round(flat.lineHeight * 1.2) } : null),
    ...(flat.letterSpacing ? { letterSpacing: 0 } : null),
  };
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  display: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: 800,
    letterSpacing: -1,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: 800,
    letterSpacing: -0.5,
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  linkPrimary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
