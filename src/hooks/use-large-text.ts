import { useWindowDimensions } from 'react-native';

import { MaxFontScale } from '@/constants/theme';

/**
 * True when the phone's font size leaves little room across the screen, e.g. a 360dp phone
 * with a large font. Rows can then drop extras (like an avatar) so the text gets the width.
 */
export function useLargeText() {
  const { width, fontScale } = useWindowDimensions();
  return width / Math.min(fontScale, MaxFontScale) < 300;
}
