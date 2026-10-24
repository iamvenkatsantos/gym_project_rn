import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { sendPasswordReset, signInAsDemo, signInWithPassword, signUp } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import type { Profile, Role } from '@/features/auth/types';
import { useTheme } from '@/hooks/use-theme';
import { isDemoMode } from '@/lib/env';

const demoRoles: { role: Role; title: string; detail: string; icon: IconName }[] = [
  { role: 'member', title: 'Member', detail: 'Book classes and track your plan', icon: 'person' },
  { role: 'trainer', title: 'Trainer', detail: 'See your schedule and workouts', icon: 'barbell' },
  { role: 'owner', title: 'Gym owner', detail: 'Members, classes and renewals', icon: 'business' },
];

export default function SignInScreen() {
  const theme = useTheme();
  const setProfile = useAuthStore((s) => s.setProfile);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetHint, setResetHint] = useState(false);

  const onSignedIn = (profile: Profile) => {
    setProfile(profile);
    router.replace('/');
  };
  const passwordSignIn = useMutation({
    mutationFn: () => signInWithPassword(email.trim(), password),
    onSuccess: onSignedIn,
  });
  const createAccount = useMutation({
    mutationFn: () => signUp(fullName.trim(), email.trim(), password),
    onSuccess: (profile) => profile && onSignedIn(profile),
  });
  const resetPassword = useMutation({ mutationFn: () => sendPasswordReset(email.trim()) });
  const demoSignIn = useMutation({ mutationFn: signInAsDemo, onSuccess: onSignedIn });
  const linkError = useAuthStore((s) => s.linkError);
  const error =
    (mode === 'signIn' ? (passwordSignIn.error ?? resetPassword.error) : createAccount.error) ??
    demoSignIn.error;
  const awaitingConfirmation = mode === 'signUp' && createAccount.isSuccess && !createAccount.data;

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
  ];

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.brand}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
          <ThemedText type="heading">CoreFit</ThemedText>
        </View>
        <ThemedText type="display">
          Train.{'\n'}Book.{'\n'}Repeat.
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Classes, workouts and your membership in one place.
        </ThemedText>
      </View>

      {!isDemoMode ? (
        <View style={styles.form}>
          {mode === 'signUp' ? (
            <TextInput
              style={inputStyle}
              placeholder="Full name"
              placeholderTextColor={theme.textSecondary}
              autoComplete="name"
              textContentType="name"
              value={fullName}
              onChangeText={setFullName}
            />
          ) : null}
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
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {linkError ? (
            <Card>
              <ThemedText type="smallBold">That email link didn&apos;t work</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {linkError}. Links work once and expire. If the email has a code, tap Enter it
                below. Otherwise sign in, use Forgot password, or ask your gym to invite you again.
              </ThemedText>
            </Card>
          ) : null}
          {mode === 'signIn' ? (
            <>
              <Button
                label="Sign in"
                loading={passwordSignIn.isPending}
                disabled={!email || !password}
                onPress={() => passwordSignIn.mutate()}
              />
              {resetPassword.isSuccess ? (
                <Card highlighted>
                  <ThemedText type="heading">Check your email</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    If {email.trim()} has a CoreFit account, we sent it a link and a code. Open the
                    link on this phone, or enter the code below.
                  </ThemedText>
                </Card>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  disabled={resetPassword.isPending}
                  onPress={() => (email.trim() ? resetPassword.mutate() : setResetHint(true))}
                  style={styles.switchMode}>
                  <ThemedText type="linkPrimary">
                    {resetPassword.isPending ? 'Sending…' : 'Forgot password?'}
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/enter-code',
                    params: resetPassword.isSuccess
                      ? { email: email.trim(), kind: 'recovery' }
                      : { email: email.trim() },
                  })
                }
                style={styles.switchMode}>
                <ThemedText type="small" themeColor="textSecondary">
                  Got a code by email? <ThemedText type="linkPrimary">Enter it</ThemedText>
                </ThemedText>
              </Pressable>
              {resetHint && !email.trim() ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Enter your email above, then tap Forgot password.
                </ThemedText>
              ) : null}
            </>
          ) : awaitingConfirmation ? (
            <Card highlighted>
              <ThemedText type="heading">Check your email</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                We sent a link and a code to {email.trim()}. Open the link on this phone, or enter
                the code. If your gym invited this email, you&apos;ll be in your gym straight away.
              </ThemedText>
              <Button
                label="Enter the code"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/enter-code',
                    params: { email: email.trim(), kind: 'signup' },
                  })
                }
              />
            </Card>
          ) : (
            <Button
              label="Create account"
              loading={createAccount.isPending}
              disabled={!fullName.trim() || !email || password.length < 8}
              onPress={() => createAccount.mutate()}
            />
          )}
          <Pressable
            accessibilityRole="button"
            onPress={() => setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'))}
            style={styles.switchMode}>
            <ThemedText type="small" themeColor="textSecondary">
              {mode === 'signIn' ? 'New to CoreFit? ' : 'Already have an account? '}
              <ThemedText type="linkPrimary">
                {mode === 'signIn' ? 'Create an account' : 'Sign in'}
              </ThemedText>
            </ThemedText>
          </Pressable>
          {mode === 'signUp' && !awaitingConfirmation ? (
            <ThemedText type="small" themeColor="textSecondary">
              Use the email your gym has on file. Passwords need at least 8 characters.
            </ThemedText>
          ) : null}
        </View>
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
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logo: {
    width: 48,
    height: 48,
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
  switchMode: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
