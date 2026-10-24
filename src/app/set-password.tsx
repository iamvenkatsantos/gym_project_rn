import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { setPassword } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { useProfile } from '@/features/auth/use-profile';
import { useSignOut } from '@/features/auth/use-sign-out';

const MIN_LENGTH = 8;

/** After an invite or password reset link: choose a password, then go to your gym. */
export default function SetPasswordScreen() {
  const profile = useProfile();
  const signOut = useSignOut();
  const [fullName, setFullName] = useState('');
  const [password, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // Invited people have no name yet; someone resetting a password already does.
  const askName = !profile.fullName.trim();
  const gymName = profile.gyms[0]?.gymName;

  const save = useMutation({
    mutationFn: () => setPassword(password, askName ? fullName.trim() : undefined),
    onSuccess: (next) => {
      const { setProfile, setNeedsPassword } = useAuthStore.getState();
      setNeedsPassword(false);
      setProfile(next);
      router.replace('/');
    },
  });

  const problem =
    askName && !fullName.trim()
      ? 'Enter your name'
      : password.length < MIN_LENGTH
        ? `Passwords need at least ${MIN_LENGTH} characters`
        : password !== confirm
          ? "The passwords don't match"
          : null;

  return (
    <Screen title={askName ? 'Welcome to CoreFit' : 'Choose a new password'}>
      <ThemedText themeColor="textSecondary">
        {askName
          ? `${gymName ? `${gymName} invited you. ` : ''}Set a password so you can sign in with your email from now on.`
          : 'Pick a new password for your account.'}
      </ThemedText>
      {askName ? (
        <TextField
          label="Your name"
          placeholder="Full name"
          autoComplete="name"
          textContentType="name"
          value={fullName}
          onChangeText={setFullName}
        />
      ) : null}
      <TextField
        label="Password"
        placeholder={`At least ${MIN_LENGTH} characters`}
        autoComplete="new-password"
        textContentType="newPassword"
        secureTextEntry
        value={password}
        onChangeText={setNewPassword}
      />
      <TextField
        label="Confirm password"
        autoComplete="new-password"
        textContentType="newPassword"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />
      {problem && password ? (
        <ThemedText type="small" themeColor="textSecondary">
          {problem}
        </ThemedText>
      ) : null}
      {save.error ? <ThemedText themeColor="danger">{save.error.message}</ThemedText> : null}
      <Button
        label="Save password"
        icon="lock-closed-outline"
        disabled={!!problem}
        loading={save.isPending}
        onPress={() => save.mutate()}
      />
      <Button label="Cancel" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
