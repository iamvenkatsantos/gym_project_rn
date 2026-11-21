import { selectActiveGym } from '@/features/auth/auth-store';
import { Colors, getPalette, isThemeColor, ThemeColors } from '@/constants/theme';

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme colours', () => {
  it('green is the original palette', () => {
    expect(getPalette('dark', 'green')).toBe(Colors.dark);
    expect(getPalette('light', 'green')).toBe(Colors.light);
  });

  it('falls back to green for an unknown colour', () => {
    expect(isThemeColor('teal')).toBe(false);
    expect(getPalette('dark', 'teal' as never)).toBe(Colors.dark);
  });

  it('keeps status colours the same in every theme', () => {
    for (const id of ThemeColors) {
      for (const scheme of ['light', 'dark'] as const) {
        const p = getPalette(scheme, id);
        expect(p.success).toBe(Colors[scheme].success);
        expect(p.warning).toBe(Colors[scheme].warning);
        expect(p.danger).toBe(Colors[scheme].danger);
      }
    }
  });

  it('keeps text readable in every theme', () => {
    for (const id of ThemeColors) {
      for (const scheme of ['light', 'dark'] as const) {
        const p = getPalette(scheme, id);
        expect(contrast(p.accent, p.background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.accent, p.backgroundElement)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.onPrimary, p.primary)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.text, p.background)).toBeGreaterThanOrEqual(7);
      }
    }
  });
});

describe('gym theme colour on the profile', () => {
  it('useTheme reads the active gym, not the phone', () => {
    const gym = { gymId: 'g', gymName: 'G', role: 'member', themeColor: 'pink' };
    const state = { profile: { gyms: [gym] }, activeGymId: 'g', adminMode: false };
    expect(selectActiveGym(state as never)?.themeColor).toBe('pink');
  });
});
