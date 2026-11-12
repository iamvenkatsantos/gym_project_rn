import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { markCodeSent, resendLabel, resendWaitSeconds } from '@/features/auth/resend';

/** Ticks every second while a wait is running for this email. */
export function useResendWait(email: string): number {
  const [, tick] = useState(0);
  const left = resendWaitSeconds(email);
  const waiting = left > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [waiting]);
  return left;
}

/**
 * Sends an emailed code again, at most once a minute per email (Supabase's own limit).
 * Every screen that waits on an emailed code shows one, so a lost email never leaves
 * someone stuck.
 */
export function ResendCodeButton({
  email,
  send,
  disabled,
  onSent,
}: {
  email: string;
  send: (email: string) => Promise<unknown>;
  disabled?: boolean;
  onSent?: () => void;
}) {
  const wait = useResendWait(email);
  const resend = useMutation({
    mutationFn: () => send(email.trim()),
    onSuccess: () => {
      markCodeSent(email);
      onSent?.();
    },
  });
  return (
    <>
      <Button
        label={resendLabel(wait)}
        icon="refresh-outline"
        variant="secondary"
        size="compact"
        disabled={disabled || wait > 0}
        loading={resend.isPending}
        onPress={() => resend.mutate()}
      />
      {resend.isSuccess && wait > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          New code sent. Check spam too.
        </ThemedText>
      ) : null}
      {resend.error ? (
        <ThemedText type="small" themeColor="danger">
          {resend.error.message}
        </ThemedText>
      ) : null}
    </>
  );
}
