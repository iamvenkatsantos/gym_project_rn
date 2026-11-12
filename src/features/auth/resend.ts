/** Supabase sends one auth email per address a minute, so the app waits as long. */
export const RESEND_WAIT_SECONDS = 60;

// When a code was last sent to each email, kept while the app runs so the wait
// carries over from Sign in to Enter code.
const sentAt = new Map<string, number>();

const key = (email: string) => email.trim().toLowerCase();

export function markCodeSent(email: string, now = Date.now()) {
  sentAt.set(key(email), now);
}

/** Seconds left before another code can go to this email; 0 when it can. */
export function resendWaitSeconds(email: string, now = Date.now()): number {
  const last = sentAt.get(key(email));
  if (last === undefined) return 0;
  const left = Math.ceil((last + RESEND_WAIT_SECONDS * 1000 - now) / 1000);
  return Math.max(0, Math.min(RESEND_WAIT_SECONDS, left));
}

/** Label for a resend button: "Resend code in 42 s" while waiting. */
export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `Resend code in ${secondsLeft} s` : 'Resend code';
}
