import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { fetchProfile, verifyEmailCode } from '@/features/auth/api';
import type { LinkSession } from '@/features/auth/auth-link';
import { useAuthStore } from '@/features/auth/auth-store';

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
  // Try the kind of email they were just sent first.
  const order = params.kind ? [params.kind, ...kinds.filter((k) => k !== params.kind)] : kinds;

  const verify = useMutation({
    mutationFn: async () => {
      const { type, userId } = await verifyEmailCode(email.trim(), code.trim(), order);
      // Invites and resets choose a password before reaching their screens.
      useAuthStore.getState().setNeedsPassword(type !== 'signup');
      return fetchProfile(userId);
    },
    onSuccess: (profile) => {
      useAuthStore.getState().setProfile(profile);
      router.replace('/');
    },
  });

  return (
    <Screen>
      <ThemedText themeColor="textSecondary">
        Enter the email the code was sent to and the code from that email. Codes work once.
      </ThemedText>
      <TextField
        label="Email"
        placeholder="name@example.com"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Code"
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
      />
      {verify.error ? (
        <ThemedText themeColor="danger">
          {verify.error.message}. Check the code, or ask for a new email.
        </ThemedText>
      ) : null}
      <Button
        label="Continue"
        icon="arrow-forward"
        disabled={!email.trim() || code.length < 6}
        loading={verify.isPending}
        onPress={() => verify.mutate()}
      />
    </Screen>
  );
}
