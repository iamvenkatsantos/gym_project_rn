import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { demoFor } from '@/features/exercises/demos';
import type { Exercise } from '@/features/exercises/types';
import { useTheme } from '@/hooks/use-theme';

/** Time on each position; long enough to read the pose between sets. */
const FRAME_MS = 1100;

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
 * Loops an exercise's start and end positions. Pauses for people who ask the
 * system to reduce motion; they can still step through by tapping.
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
    const id = setInterval(() => setFrame((f) => (f + 1) % frameCount), FRAME_MS);
    return () => clearInterval(id);
  }, [animating, frameCount]);

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

  const image = (
    <Image
      source={media.frames[frame % frameCount]}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      transition={thumb ? 0 : 250}
      accessibilityIgnoresInvertColors
    />
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
