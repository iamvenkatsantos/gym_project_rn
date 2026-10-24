import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { signInAsDemo, signInWithPassword } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import type { Profile, Role } from '@/features/auth/types';
import { useTheme } from '@/hooks/use-theme';
import { isDemoMode, isSupabaseConfigured } from '@/lib/env';

const demoRoles: { role: Role; title: string; detail: string; icon: IconName }[] = [
  { role: 'member', title: 'Member', detail: 'Book classes and track your plan', icon: 'person' },
  { role: 'trainer', title: 'Trainer', detail: 'See your schedule and workouts', icon: 'barbell' },
  { role: 'owner', title: 'Gym owner', detail: 'Members, classes and renewals', icon: 'business' },
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

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
  ];

  return (
    <Screen>
      <View style={styles.hero}>
        <ThemedText type="label" themeColor="primary">
          Gym App
        </ThemedText>
        <ThemedText type="display">
          Train.{'\n'}Book.{'\n'}Repeat.
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Classes, workouts and your membership in one place.
        </ThemedText>
      </View>

      {isSupabaseConfigured ? (
        <View style={styles.form}>
          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={inputStyle}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            autoComplete="current-password"
            textContentType="password"
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
        </View>
      ) : !isDemoMode ? (
        <ThemedText themeColor="danger">
          This build has no backend configured. Set EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY.
        </ThemedText>
      ) : (
        <View style={styles.form}>
          <ThemedText type="label" themeColor="textSecondary">
            Explore the demo as
          </ThemedText>
          {demoRoles.map(({ role, title, detail, icon }) => (
            <Pressable
              key={role}
              accessibilityRole="button"
              accessibilityLabel={`Continue as ${title}`}
              disabled={demoSignIn.isPending}
              onPress={() => demoSignIn.mutate(role)}>
              {({ pressed }) => (
                <Card style={[styles.roleCard, pressed && styles.pressed]}>
                  <View style={[styles.roleIcon, { backgroundColor: theme.backgroundSelected }]}>
                    <Icon name={icon} size={22} color="primary" />
                  </View>
                  <View style={styles.roleBody}>
                    <ThemedText type="heading">{title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {detail}
                    </ThemedText>
                  </View>
                  {demoSignIn.isPending && demoSignIn.variables === role ? (
                    <ActivityIndicator color={theme.primary} />
                  ) : (
                    <Icon name="chevron-forward" size={20} />
                  )}
                </Card>
              )}
            </Pressable>
          ))}
        </View>
      )}
      {error ? <ThemedText themeColor="danger">{error.message}</ThemedText> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.three,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
  },
  form: {
    gap: Spacing.three,
  },
  input: {
    minHeight: TapTarget,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBody: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
});
