/** Look for a new over-the-air update at most this often when the app comes back to the front. */
export const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function shouldCheckForUpdate(lastCheckedAt: number | null, now: number): boolean {
  return lastCheckedAt === null || now - lastCheckedAt >= CHECK_INTERVAL_MS;
}

/** "1.0.0" for the build's own code, "1.0.0 · a1b2c3" once an update is running. */
export function versionLabel(
  version: string | undefined,
  updateId: string | null,
  isEmbeddedLaunch: boolean,
): string {
  const base = version ?? '';
  if (isEmbeddedLaunch || !updateId) return base;
  return `${base} · ${updateId.slice(0, 6)}`.trim();
}
