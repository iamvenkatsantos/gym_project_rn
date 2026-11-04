import { CHECK_INTERVAL_MS, shouldCheckForUpdate, versionLabel } from '../rules';

describe('shouldCheckForUpdate', () => {
  it('checks when never checked', () => {
    expect(shouldCheckForUpdate(null, 1000)).toBe(true);
  });

  it('waits an hour between checks', () => {
    expect(shouldCheckForUpdate(0, CHECK_INTERVAL_MS - 1)).toBe(false);
    expect(shouldCheckForUpdate(0, CHECK_INTERVAL_MS)).toBe(true);
  });
});

describe('versionLabel', () => {
  it('shows only the version for the build’s own code', () => {
    expect(versionLabel('1.0.0', 'abcdef-123', true)).toBe('1.0.0');
    expect(versionLabel('1.0.0', null, false)).toBe('1.0.0');
  });

  it('adds the short update id once an update runs', () => {
    expect(versionLabel('1.0.0', 'a1b2c3d4-0000', false)).toBe('1.0.0 · a1b2c3');
  });
});
