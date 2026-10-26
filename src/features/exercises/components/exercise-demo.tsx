import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { demoFor, type DemoFrame } from '@/features/exercises/demos';
import type { Exercise } from '@/features/exercises/types';
import { useTheme } from '@/hooks/use-theme';

/** Time held on each position; long enough to read the pose between sets. */
const HOLD_MS = 900;
/** Crossfade between positions, eased so it reads as one movement rather than a cut. */
const FADE_MS = 700;
const FADE = { duration: FADE_MS, easing: Easing.inOut(Easing.cubic) };

type ExerciseDemoProps = {
  exerciseId: string;
  imageUrl?: Exercise['imageUrl'];
  name: string;
  /** `full` fills the width with play/pause and credit; `thumb` is a small looping preview. */
  variant?: 'full' | 'thumb';
  /** Defaults to looping for `full` and a still start position for `thumb`. */
  animate?: boolean;
};

/**
 * Loops an exercise's start and end positions, crossfading between them. Pauses
 * for people who ask the system to reduce motion; they can still step through
 * by tapping, and then the positions switch without a fade.
 */
export function ExerciseDemo({
  exerciseId,
  imageUrl,
  name,
  variant = 'full',
  animate,
}: ExerciseDemoProps) {
  const theme = useTheme();
  const media = demoFor(exerciseId, imageUrl);
  const reduceMotion = useReducedMotion();
  const thumb = variant === 'thumb';
  const [playing, setPlaying] = useState(!reduceMotion && (animate ?? !thumb));
  const [frame, setFrame] = useState(0);
  const frameCount = media?.frames.length ?? 0;
  const animating = playing && frameCount > 1;

  useEffect(() => {
    if (!animating) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % frameCount), HOLD_MS + FADE_MS);
    return () => clearInterval(id);
  }, [animating, frameCount]);

  // Which frame is showing, as a float while fading: 0.5 is halfway from the first to the second.
  const shown = useSharedValue(0);
  useEffect(() => {
    shown.value = reduceMotion ? frame : withTiming(frame, FADE);
  }, [frame, reduceMotion, shown]);

  const box = [thumb ? styles.thumb : styles.full, { backgroundColor: theme.backgroundSelected }];

  if (!media) {
    return thumb ? (
      <View style={[box, styles.center]}>
        <Icon name="barbell-outline" size={22} />
      </View>
    ) : (
      <View style={[box, styles.center]}>
        <Icon name="image-outline" size={40} />
        <ThemedText type="small" themeColor="textSecondary">
          Demonstration coming soon
        </ThemedText>
      </View>
    );
  }

  // Every frame stays mounted, stacked in order, so a fade never waits on an image to decode.
  const image = (
    <>
      {media.frames.map((source, i) => (
        <DemoLayer key={i} source={source} index={i} shown={shown} />
      ))}
    </>
  );

  if (thumb) {
    return (
      <View style={box} accessibilityRole="image" accessibilityLabel={`${name} demonstration`}>
        {image}
      </View>
    );
  }

  const position = frameCount > 1 ? (frame % frameCount === 0 ? 'Start' : 'Finish') : null;

  return (
    <View style={styles.wrapper}>
      <View style={box}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name} demonstration`}
          accessibilityHint={
            frameCount > 1
              ? animating
                ? 'Pauses the demonstration'
                : 'Shows the next position'
              : undefined
          }
          onPress={() => {
            if (frameCount < 2) return;
            if (animating) setPlaying(false);
            else setFrame((f) => (f + 1) % frameCount);
          }}
          style={StyleSheet.absoluteFill}>
          {image}
        </Pressable>
        {position ? (
          <View
            pointerEvents="none"
            style={[styles.badge, styles.badgeStart, { backgroundColor: theme.background }]}>
            <ThemedText type="label">{position}</ThemedText>
          </View>
        ) : null}
        {frameCount > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={animating ? 'Pause demonstration' : 'Play demonstration'}
            hitSlop={12}
            onPress={() => setPlaying((p) => !p)}
            style={[styles.badge, styles.badgeEnd, { backgroundColor: theme.background }]}>
            <Icon name={animating ? 'pause' : 'play'} size={18} color="text" />
          </Pressable>
        ) : null}
      </View>
      {media.credit ? (
        <ThemedText type="small" themeColor="textSecondary">
          {media.credit}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** One position, faded in over the ones below it as `shown` passes its index. */
function DemoLayer({
  source,
  index,
  shown,
}: {
  source: DemoFrame;
  index: number;
  shown: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: index === 0 ? 1 : Math.min(Math.max(shown.value - (index - 1), 0), 1),
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={0}
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
  },
  full: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: Radius.large,
    overflow: 'hidden',
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.small,
    overflow: 'hidden',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  badge: {
    position: 'absolute',
    bottom: Spacing.two,
    minHeight: 32,
    minWidth: 32,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
  },
  badgeStart: {
    left: Spacing.two,
  },
  badgeEnd: {
    right: Spacing.two,
  },
});
