/**
 * The launch intro's timing and layout. The native splash shows the logo alone; the intro takes
 * over with the same picture, gives the logo a lift, then slides it left as the wordmark arrives,
 * and fades out once sign-in has loaded.
 */

/** The logo's width on the native splash (`imageWidth` of `expo-splash-screen` in app.json). */
export const NATIVE_LOGO_SIZE = 200;
/** How big the logo ends up next to the wordmark, as a share of its native size. */
export const LOGO_END_SCALE = 0.56;
/** Space between the logo and the wordmark (the logo image has its own padding too). */
export const LOCKUP_GAP = 2;

export const Timeline = {
  /** The logo grows a little, then settles. */
  liftAt: 120,
  liftMs: 520,
  /** The logo shrinks and moves left while the wordmark slides in. */
  slideAt: 640,
  slideMs: 560,
  /** The tagline fades in under the wordmark. */
  taglineAt: 1050,
  taglineMs: 380,
  /** Earliest the intro may leave, even if sign-in loaded sooner. */
  minShowMs: 1900,
  /** With reduce motion on, the lockup shows still for this long. */
  stillShowMs: 700,
  fadeOutMs: 380,
} as const;

/**
 * Where the logo and the wordmark end up, as x offsets of their centres from the screen's centre,
 * so the two read as one lockup centred on the screen.
 */
export function lockupOffsets(wordmarkWidth: number) {
  'worklet';
  const logo = NATIVE_LOGO_SIZE * LOGO_END_SCALE;
  const total = logo + LOCKUP_GAP + wordmarkWidth;
  return {
    logoX: -total / 2 + logo / 2,
    wordmarkX: -total / 2 + logo + LOCKUP_GAP + wordmarkWidth / 2,
  };
}
