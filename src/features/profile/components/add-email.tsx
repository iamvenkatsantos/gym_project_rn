import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { confirmEmailChange, requestEmailChange, resendEmailChange } from '@/features/auth/api';
import { ResendCodeButton } from '@/features/auth/components/resend-code-button';
import { markCodeSent } from '@/features/auth/resend';
import { useAccountEmail } from '@/features/auth/use-profile';
import { isMobileLogin } from '@/lib/mobile-login';
import { normalizeEmail, validateCode, validateEmail } from '@/lib/validation';

/**
 * People who sign in with their mobile number can add an email, so they can reset
 * a forgotten password themselves. A code goes to the new address; once confirmed
 * they sign in with that email.
 */
export function AddEmail() {
  const account = useAccountEmail();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const send = useMutation({
    mutationFn: () => requestEmailChange(normalizeEmail(email)),
    onSuccess: () => markCodeSent(normalizeEmail(email)),
  });
  const confirm = useMutation({
    mutationFn: () => confirmEmailChange(normalizeEmail(email), code.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account-email'] }),
  });

  if (confirm.isSuccess) {
    return (
      <Card highlighted>
        <ThemedText type="smallBold">Email added</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Sign in with {normalizeEmail(email)} from now on.
        </ThemedText>
      </Card>
    );
  }
  if (!isMobileLogin(account.data)) return null;

  const emailError = validateEmail(email);
  const codeError = validateCode(code);
  return (
    <Card>
      <ThemedText type="smallBold">Add an email</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        So you can reset your password yourself.
      </ThemedText>
      <TextField
        label="Email"
        placeholder="name@example.com"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          send.reset();
          confirm.reset();
        }}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        maxLength={254}
        error={email ? emailError : null}
      />
      {send.isSuccess ? (
        <>
          <TextField
            label="Code from the email"
            placeholder="123456"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={10}
            error={code ? codeError : null}
          />
          <Button
            label="Confirm email"
            size="compact"
            disabled={!!codeError}
            loading={confirm.isPending}
            onPress={() => confirm.mutate()}
          />
          <ResendCodeButton email={normalizeEmail(email)} send={resendEmailChange} />
        </>
      ) : (
        <Button
          label="Send code"
          icon="mail-outline"
          variant="secondary"
          size="compact"
          disabled={!!emailError}
          loading={send.isPending}
          onPress={() => send.mutate()}
        />
      )}
      {send.error || confirm.error ? (
        <ThemedText type="small" themeColor="danger">
          {(send.error ?? confirm.error)?.message}
        </ThemedText>
      ) : null}
    </Card>
  );
}
