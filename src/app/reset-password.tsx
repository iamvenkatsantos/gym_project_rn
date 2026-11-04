import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { resetPasswordWithCode } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { isInviteCode, normalizeInviteCode } from '@/features/members/rules';
import {
  firstError,
  MAX_PASSWORD,
  validateNewPassword,
  validatePasswordMatch,
} from '@/lib/validation';

/**
 * For people who sign in with their mobile number (no email to send a reset to):
 * the gym sends a one-time reset code on WhatsApp, and they choose a new password here.
 */
export default function ResetPasswordScreen() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const clean = normalizeInviteCode(code);
  const codeError = isInviteCode(clean) ? null : 'The code has 8 letters and numbers.';
  const passwordError = validateNewPassword(password);
  const confirmError = validatePasswordMatch(password, confirm);

  const reset = useMutation({
    mutationFn: () => resetPasswordWithCode(clean, password),
    onSuccess: (profile) => {
      useAuthStore.getState().setProfile(profile);
      router.replace('/');
    },
  });

  return (
    <Screen refreshable={false}>
      <ThemedText type="small" themeColor="textSecondary">
        Enter the reset code your gym sent on WhatsApp.
      </ThemedText>
      <TextField
        label="Reset code"
        icon="keypad-outline"
        placeholder="K7P2-QX4M"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={10}
        value={code}
        onChangeText={(text) => {
          setCode(text.toUpperCase());
          reset.reset();
        }}
        error={code ? codeError : null}
      />
      <TextField
        label="New password"
        icon="lock-closed-outline"
        placeholder="8+ letters and numbers"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        secureTextEntry
        maxLength={MAX_PASSWORD}
        value={password}
        onChangeText={setPassword}
        error={password ? passwordError : null}
      />
      <TextField
        label="Confirm password"
        icon="lock-closed-outline"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        secureTextEntry
        maxLength={MAX_PASSWORD}
        value={confirm}
        onChangeText={setConfirm}
        error={confirm ? confirmError : null}
      />
      {reset.error ? <ThemedText themeColor="danger">{reset.error.message}</ThemedText> : null}
      <Button
        label="Set password"
        icon="checkmark"
        disabled={!!firstError(codeError, passwordError, confirmError)}
        loading={reset.isPending}
        onPress={() => reset.mutate()}
      />
    </Screen>
  );
}
