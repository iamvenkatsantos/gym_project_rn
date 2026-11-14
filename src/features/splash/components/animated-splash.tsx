import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BrandGreen, Colors, MaxFontScale, SplashBackground } from '@/constants/theme';
import {
  LOGO_END_SCALE,
  NATIVE_LOGO_SIZE,
  Timeline,
  lockupOffsets,
} from '@/features/splash/timeline';

const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN_OUT = Easing.inOut(Easing.cubic);

type AnimatedSplashProps = {
  /** True once the app knows where to open (sign-in has loaded). The intro waits for it. */
  ready: boolean;
};

/**
 * The launch intro, drawn over the app. It starts as an exact copy of the native splash (dark
 * background, logo centred at its native size), hides the native one, then animates the logo
 * into a logo + wordmark lockup and fades away once the app is ready underneath. Always dark,
 * like the native splash, because the logo has white parts.
 */
export function AnimatedSplash({ ready }: AnimatedSplashProps) {
  const reduceMotion = useReducedMotion();
  const [introDone, setIntroDone] = useState(false);
  const [gone, setGone] = useState(false);
  const started = useRef(false);

  const lift = useSharedValue(0);
  const slide = useSharedValue(0);
  const tagline = useSharedValue(0);
  const shown = useSharedValue(1);
  const wordmarkWidth = useSharedValue(0);

  // The first frame matches the native splash, so swapping them is invisible.
  const onFirstLayout = () => {
    if (started.current) return;
    started.current = true;
    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => {
        if (reduceMotion) {
          slide.value = 1;
          tagline.value = 1;
        } else {
          lift.value = withDelay(
            Timeline.liftAt,
            withSequence(
              withTiming(1, { duration: Timeline.liftMs / 2, easing: EASE_OUT }),
              withTiming(0, { duration: Timeline.liftMs / 2, easing: EASE_IN_OUT }),
            ),
          );
          slide.value = withDelay(
            Timeline.slideAt,
            withTiming(1, { duration: Timeline.slideMs, easing: EASE_IN_OUT }),
          );
          tagline.value = withDelay(
            Timeline.taglineAt,
            withTiming(1, { duration: Timeline.taglineMs, easing: EASE_OUT }),
          );
        }
        setTimeout(
          () => setIntroDone(true),
          reduceMotion ? Timeline.stillShowMs : Timeline.minShowMs,
        );
      });
  };

  const leaving = introDone && ready;
  useEffect(() => {
    if (!leaving) return;
    shown.value = withTiming(0, { duration: Timeline.fadeOutMs, easing: EASE_IN_OUT });
    const id = setTimeout(() => setGone(true), Timeline.fadeOutMs + 50);
    return () => clearTimeout(id);
  }, [leaving, shown]);

  const onWordmarkLayout = (e: LayoutChangeEvent) => {
    wordmarkWidth.value = e.nativeEvent.layout.width;
  };

  const overlayStyle = useAnimatedStyle(() => ({ opacity: shown.value }));

  const logoStyle = useAnimatedStyle(() => {
    const { logoX } = lockupOffsets(wordmarkWidth.value);
    const scale =
      interpolate(slide.value, [0, 1], [1, LOGO_END_SCALE]) *
      interpolate(lift.value, [0, 1], [1, 1.12]);
    return {
      transform: [{ translateX: slide.value * logoX }, { translateY: lift.value * -10 }, { scale }],
    };
  });

  const wordmarkStyle = useAnimatedStyle(() => {
    const { wordmarkX } = lockupOffsets(wordmarkWidth.value);
    return {
      opacity: interpolate(slide.value, [0.35, 1], [0, 1], 'clamp'),
      transform: [{ translateX: wordmarkX + (1 - slide.value) * 40 }],
    };
  });

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: (1 - tagline.value) * 6 }],
  }));

  if (gone) return null;

  return (
    <Animated.View
      onLayout={onFirstLayout}
      pointerEvents={leaving ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.overlay, overlayStyle]}
      accessible
      accessibilityLabel="CoreFit">
      <Animated.View style={[styles.centre, logoStyle]}>
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
        <Animated.View onLayout={onWordmarkLayout} style={wordmarkStyle}>
          <Text style={styles.wordmark} maxFontSizeMultiplier={MaxFontScale} numberOfLines={1}>
            Core<Text style={styles.fit}>Fit</Text>
          </Text>
          <Animated.Text
            style={[styles.tagline, taglineStyle]}
            maxFontSizeMultiplier={MaxFontScale}
            numberOfLines={1}>
            TRAIN · TRACK · GROW
          </Animated.Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: SplashBackground,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: NATIVE_LOGO_SIZE,
    height: NATIVE_LOGO_SIZE,
  },
  wordmark: {
    color: Colors.dark.text,
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  fit: {
    color: BrandGreen,
  },
  tagline: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
    marginTop: 2,
  },
});
