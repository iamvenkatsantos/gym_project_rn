import { cleanTagline, MAX_TAGLINE, validateTagline } from '@/features/gyms/rules';

describe('gym tagline', () => {
  it('trims and collapses spaces', () => {
    expect(cleanTagline('  Train   hard.  ')).toBe('Train hard.');
    expect(cleanTagline('   ')).toBe('');
  });

  it('allows up to the limit and refuses more', () => {
    expect(validateTagline('a'.repeat(MAX_TAGLINE))).toBeNull();
    expect(validateTagline('a'.repeat(MAX_TAGLINE + 1))).toBe('Keep it to 60 characters.');
    expect(validateTagline('')).toBeNull();
  });
});
