import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ProgressRingProps = {
  /** 0 to 1, filled clockwise from the top. */
  value: number;
  size?: number;
  thickness?: number;
  color?: ThemeColor;
  /** Shown in the middle. */
  children?: ReactNode;
  accessibilityLabel?: string;
};

/**
 * A circular progress ring from plain views (no SVG, so it ships over the air). Each half of
 * the ring is a circle with two coloured border sides (a half ring), rotated inside a clip
 * that shows only its side of the circle.
 */
export function ProgressRing({
  value,
  size = 88,
  thickness = 9,
  color = 'primary',
  children,
  accessibilityLabel,
}: ProgressRingProps) {
  const theme = useTheme();
  const clamped = Math.min(Math.max(value, 0), 1);
  const right = Math.min(clamped, 0.5) * 360;
  const left = Math.max(clamped - 0.5, 0) * 360;
  const half = size / 2;

  const circle = {
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: thickness,
  };
  // Left + bottom sides colour the half ring from 135° to 315° (clockwise from the top).
  const halfRing = {
    ...circle,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: theme[color],
    borderLeftColor: theme[color],
  };

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={{ width: size, height: size }}>
      <View style={[styles.layer, circle, { borderColor: theme.backgroundSelected }]} />
      {right > 0 ? (
        // Right clip shows 0°..180°; the half ring is turned to end at `right`.
        <View style={[styles.clip, { left: half, width: half, height: size }]}>
          <View
            style={[
              styles.layer,
              halfRing,
              { left: -half, transform: [{ rotate: `${right + 45}deg` }] },
            ]}
          />
        </View>
      ) : null}
      {left > 0 ? (
        // Left clip shows 180°..360°; the half ring starts at 0° and turns past 180°.
        <View style={[styles.clip, { left: 0, width: half, height: size }]}>
          <View
            style={[
              styles.layer,
              halfRing,
              { left: 0, transform: [{ rotate: `${left - 135}deg` }] },
            ]}
          />
        </View>
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.centre]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  clip: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
