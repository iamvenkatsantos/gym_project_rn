import { describe, expect, it } from 'vitest';

import { gymThemeCss } from '../theme';

describe('gymThemeCss', () => {
  it('leaves the dashboard green by default', () => {
    expect(gymThemeCss('green')).toBe('');
  });

  it('swaps the colour variables for light and dark', () => {
    const css = gymThemeCss('blue');
    expect(css).toContain('--primary:#3B9EFF');
    expect(css).toContain('--accent:#1D5FD0'); // light
    expect(css).toContain('prefers-color-scheme: dark');
    expect(css).toContain('--accent:#5AAEFF'); // dark
  });
});
