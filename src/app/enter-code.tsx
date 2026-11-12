import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import {
  fetchProfile,
  resendSignupCode,
  sendPasswordReset,
  verifyEmailCode,
} from '@/features/auth/api';
import type { LinkSession } from '@/features/auth/auth-link';
import { useAuthStore } from '@/features/auth/auth-store';
import { ResendCodeButton } from '@/features/auth/components/resend-code-button';
import { firstError, validateCode, validateEmail } from '@/lib/validation';

type Kind = LinkSession['type'];
const kinds: Kind[] = ['invite', 'recovery', 'signup'];

/**
 * Signs in with the code from an invite, password reset or confirmation email.
 * Works wherever the email was opened, unlike the link, which needs this phone.
 */
export default function EnterCodeScreen() {
  const params = useLocalSearchParams<{ email?: string; kind?: Kind }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const emailError = validateEmail(email);
  const codeError = validateCode(code);
  // Try the kind of email they were just sent first.
  const order = params.kind ? [params.kind, ...kinds.filter((k) => k !== params.kind)] : kinds;

  const verify = useMutation({
    mutationFn: async () => {
      const { type, userId, imported } = await verifyEmailCode(email.trim(), code.trim(), order);
      // Invites and resets choose a password before reaching their screens. So do imported
      // members confirming their sign-up: Supabase may keep the imported account passwordless.
      useAuthStore.getState().setNeedsPassword(type !== 'signup' || imported);
      return fetchProfile(userId);
    },
    onSuccess: (profile) => {
      useAuthStore.getState().setProfile(profile);
      router.replace('/');
    },
  });
  // Resets and sign-ups can ask for a new code here; invite codes come from the gym (Resend).
  const resendKind = params.kind === 'recovery' || params.kind === 'signup' ? params.kind : null;

  return (
    <Screen refreshable={false}>
      <ThemedText themeColor="textSecondary">
        Enter the email the code was sent to and the code from that email. Codes work once.
      </ThemedText>
      <TextField
        label="Email"
        icon="mail-outline"
        placeholder="name@example.com"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        maxLength={254}
        error={emailError}
      />
      <TextField
        label="Code"
        icon="keypad-outline"
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
        error={codeError}
      />
      {verify.error ? (
        <ThemedText themeColor="danger">
          {verify.error.message}. Check the code, or resend it.
        </ThemedText>
      ) : null}
      <Button
        label="Continue"
        icon="arrow-forward"
        disabled={!!firstError(emailError, codeError)}
        loading={verify.isPending}
        onPress={() => verify.mutate()}
      />
      {resendKind ? (
        <ResendCodeButton
          email={email}
          send={resendKind === 'signup' ? resendSignupCode : sendPasswordReset}
          disabled={!!emailError}
          onSent={() => setCode('')}
        />
      ) : null}
    </Screen>
  );
}
