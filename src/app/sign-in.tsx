import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { signInAsDemo, signInWithPassword } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import type { Profile, Role } from '@/features/auth/types';
import { useTheme } from '@/hooks/use-theme';
import { isSupabaseConfigured } from '@/lib/env';

const demoRoles: { role: Role; label: string }[] = [
  { role: 'member', label: 'Continue as member' },
  { role: 'trainer', label: 'Continue as trainer' },
  { role: 'owner', label: 'Continue as gym owner' },
];

export default function SignInScreen() {
  const theme = useTheme();
  const setProfile = useAuthStore((s) => s.setProfile);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSignedIn = (profile: Profile) => {
    setProfile(profile);
    router.replace(`/${profile.role}`);
  };
  const passwordSignIn = useMutation({
    mutationFn: () => signInWithPassword(email.trim(), password),
    onSuccess: onSignedIn,
  });
  const demoSignIn = useMutation({ mutationFn: signInAsDemo, onSuccess: onSignedIn });
  const error = passwordSignIn.error ?? demoSignIn.error;

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border }];

  return (
    <Screen title="Welcome to the gym">
      {isSupabaseConfigured ? (
        <Card>
          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            autoComplete="current-password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <Button
            label="Sign in"
            loading={passwordSignIn.isPending}
            disabled={!email || !password}
            onPress={() => passwordSignIn.mutate()}
          />
        </Card>
      ) : (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Supabase isn&apos;t configured, so the app is using demo data. Pick a role to explore.
          </ThemedText>
          {demoRoles.map(({ role, label }) => (
            <Button
              key={role}
              label={label}
              variant="secondary"
              loading={demoSignIn.isPending && demoSignIn.variables === role}
              disabled={demoSignIn.isPending}
              onPress={() => demoSignIn.mutate(role)}
            />
          ))}
        </Card>
      )}
      {error ? <ThemedText themeColor="primary">{error.message}</ThemedText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
  },
});
