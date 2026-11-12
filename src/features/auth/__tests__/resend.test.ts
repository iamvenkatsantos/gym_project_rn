import { markCodeSent, resendLabel, resendWaitSeconds } from '../resend';

describe('resend wait', () => {
  it('lets the first code go straight away', () => {
    expect(resendWaitSeconds('new@example.com', 0)).toBe(0);
  });

  it('waits a minute after a code, matching the email loosely', () => {
    markCodeSent(' Owner@Example.com ', 1_000);
    expect(resendWaitSeconds('owner@example.com', 1_000)).toBe(60);
    expect(resendWaitSeconds('owner@example.com', 31_500)).toBe(30);
    expect(resendWaitSeconds('owner@example.com', 61_000)).toBe(0);
  });

  it('labels the button', () => {
    expect(resendLabel(42)).toBe('Resend code in 42 s');
    expect(resendLabel(0)).toBe('Resend code');
  });
});
