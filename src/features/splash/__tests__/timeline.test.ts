import {
  LOCKUP_GAP,
  LOGO_END_SCALE,
  NATIVE_LOGO_SIZE,
  Timeline,
  lockupOffsets,
} from '@/features/splash/timeline';

describe('lockupOffsets', () => {
  it('centres the logo and wordmark together on the screen', () => {
    const width = 150;
    const { logoX, wordmarkX } = lockupOffsets(width);
    const logo = NATIVE_LOGO_SIZE * LOGO_END_SCALE;
    const left = logoX - logo / 2;
    const right = wordmarkX + width / 2;
    expect(left + right).toBeCloseTo(0);
    expect(wordmarkX - width / 2 - (logoX + logo / 2)).toBeCloseTo(LOCKUP_GAP);
  });

  it('fits a 360-wide screen at the largest font scale', () => {
    // The wordmark at 1.3x is about 210 wide.
    const { logoX } = lockupOffsets(210);
    const logo = NATIVE_LOGO_SIZE * LOGO_END_SCALE;
    expect(logoX - logo / 2).toBeGreaterThan(-180 + 16);
  });
});

describe('Timeline', () => {
  it('lets the animation finish before the intro may leave', () => {
    expect(Timeline.slideAt + Timeline.slideMs).toBeLessThan(Timeline.minShowMs);
    expect(Timeline.taglineAt + Timeline.taglineMs).toBeLessThan(Timeline.minShowMs);
  });
});
