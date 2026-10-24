import { useMutation } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { sendPasswordReset, signInAsDemo, signInWithPassword, signUp } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import type { Profile, Role } from '@/features/auth/types';
import { useTheme } from '@/hooks/use-theme';
import { isDemoMode } from '@/lib/env';
import {
  firstError,
  MAX_PASSWORD,
  MIN_PASSWORD,
  validateEmail,
  validateName,
  validateNewPassword,
} from '@/lib/validation';

const features: { label: string; icon: IconName }[] = [
  { label: 'Classes', icon: 'calendar-outline' },
  { label: 'Workouts', icon: 'barbell-outline' },
  { label: 'Membership', icon: 'card-outline' },
];

const demoRoles: { role: Role; title: string; detail: string; icon: IconName }[] = [
  { role: 'member', title: 'Member', detail: 'Book classes and track your plan', icon: 'person' },
  { role: 'trainer', title: 'Trainer', detail: 'See your schedule and workouts', icon: 'barbell' },
  {
    role: 'supervisor',
    title: 'Supervisor',
    detail: 'Payments and trainer matching',
    icon: 'shield-checkmark',
  },
  { role: 'owner', title: 'Gym owner', detail: 'Members, classes and renewals', icon: 'business' },
];

type Mode = 'signIn' | 'signUp';

export default function SignInScreen() {
  const theme = useTheme();
  const setProfile = useAuthStore((s) => s.setProfile);
  const linkError = useAuthStore((s) => s.linkError);
  const [mode, setMode] = useState<Mode>('signIn');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetHint, setResetHint] = useState(false);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

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

  const error =
    (mode === 'signIn' ? (passwordSignIn.error ?? resetPassword.error) : createAccount.error) ??
    demoSignIn.error;
  const awaitingConfirmation = mode === 'signUp' && createAccount.isSuccess && !createAccount.data;
  const nameError = mode === 'signUp' ? validateName(fullName) : null;
  const emailError = validateEmail(email);
  // Existing passwords only need to be there; new ones must be strong enough.
  const passwordError =
    mode === 'signUp' ? validateNewPassword(password) : password ? null : 'Enter your password.';
  const canSubmit = !firstError(nameError, emailError, passwordError);
  const submit = () => {
    if (!canSubmit) return;
    if (mode === 'signIn') passwordSignIn.mutate();
    else createAccount.mutate();
  };
  const enterCode = (kind?: 'recovery' | 'signup') =>
    router.push({
      pathname: '/enter-code',
      params: kind ? { email: email.trim(), kind } : { email: email.trim() },
    });

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.brand}>
          <Image source={require('@/assets/images/logo.png')} style={styles.logo} />
          <ThemedText type="heading">CoreFit Gym</ThemedText>
        </View>
        <ThemedText type="display">
          Train. Book.{'\n'}
          <ThemedText type="display" themeColor="primary">
            Repeat.
          </ThemedText>
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Your gym&apos;s classes, workouts and membership in one place.
        </ThemedText>
        <View style={styles.features}>
          {features.map((f) => (
            <View
              key={f.label}
              style={[styles.feature, { backgroundColor: theme.backgroundElement }]}>
              <Icon name={f.icon} size={14} color="primary" />
              <ThemedText type="small">{f.label}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      {isDemoMode ? (
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
                  <View style={styles.flex}>
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
          {error ? <ThemedText themeColor="danger">{error.message}</ThemedText> : null}
        </View>
      ) : (
        <>
          <SegmentedControl<Mode>
            options={[
              { value: 'signIn', label: 'Sign in' },
              { value: 'signUp', label: 'Create account' },
            ]}
            value={mode}
            onChange={setMode}
          />
          <Card style={styles.form}>
            {linkError ? (
              <View style={[styles.notice, { borderColor: theme.warning }]}>
                <ThemedText type="smallBold">That email link didn&apos;t work</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {linkError}. Links work once and expire. Use the code from the email instead, or
                  ask your gym to invite you again.
                </ThemedText>
              </View>
            ) : null}

            {awaitingConfirmation ? (
              <View style={styles.form}>
                <Icon name="mail-unread-outline" size={28} color="primary" />
                <ThemedText type="heading">Check your email</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  We sent a code to {email.trim()}. Enter it to finish. If your gym invited this
                  email, you&apos;ll be in your gym straight away.
                </ThemedText>
                <Button
                  label="Enter the code"
                  icon="keypad-outline"
                  onPress={() => enterCode('signup')}
                />
              </View>
            ) : (
              <>
                {mode === 'signUp' ? (
                  <TextField
                    label="Full name"
                    icon="person-outline"
                    placeholder="Your name"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => emailRef.current?.focus()}
                    value={fullName}
                    onChangeText={setFullName}
                    maxLength={60}
                    error={nameError}
                  />
                ) : null}
                <TextField
                  ref={emailRef}
                  label="Email"
                  icon="mail-outline"
                  placeholder="name@example.com"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  value={email}
                  onChangeText={setEmail}
                  maxLength={254}
                  error={emailError}
                />
                <TextField
                  ref={passwordRef}
                  label="Password"
                  icon="lock-closed-outline"
                  placeholder={
                    mode === 'signUp'
                      ? `${MIN_PASSWORD}+ characters, letters and a number`
                      : 'Password'
                  }
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                  secureTextEntry
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  value={password}
                  onChangeText={setPassword}
                  maxLength={MAX_PASSWORD}
                  error={passwordError}
                />

                {mode === 'signIn' ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={resetPassword.isPending || resetPassword.isSuccess}
                    hitSlop={8}
                    onPress={() => (emailError ? setResetHint(true) : resetPassword.mutate())}
                    style={styles.forgot}>
                    <ThemedText type="linkPrimary">
                      {resetPassword.isPending
                        ? 'Sending…'
                        : resetPassword.isSuccess
                          ? 'Reset email sent'
                          : 'Forgot password?'}
                    </ThemedText>
                  </Pressable>
                ) : null}
                {mode === 'signIn' && resetHint && emailError ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Enter your email above, then tap Forgot password.
                  </ThemedText>
                ) : null}
                {mode === 'signIn' && resetPassword.isSuccess ? (
                  <View style={[styles.notice, { borderColor: theme.primary }]}>
                    <ThemedText type="smallBold">Check your email</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      If {email.trim()} has a CoreFit Gym account, we sent it a code to choose a new
                      password.
                    </ThemedText>
                    <Button
                      label="Enter the code"
                      icon="keypad-outline"
                      size="compact"
                      onPress={() => enterCode('recovery')}
                    />
                  </View>
                ) : null}

                {error ? (
                  <View style={styles.errorRow}>
                    <Icon name="alert-circle-outline" size={18} color="danger" />
                    <ThemedText type="small" themeColor="danger" style={styles.flex}>
                      {error.message}
                    </ThemedText>
                  </View>
                ) : null}

                <Button
                  label={mode === 'signIn' ? 'Sign in' : 'Create account'}
                  icon={mode === 'signIn' ? 'log-in-outline' : 'person-add-outline'}
                  loading={passwordSignIn.isPending || createAccount.isPending}
                  disabled={!canSubmit}
                  onPress={submit}
                />
                {mode === 'signUp' ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Use the email your gym has on file, so you join your gym straight away.
                  </ThemedText>
                ) : null}
              </>
            )}
          </Card>

          <View style={styles.divider}>
            <View style={[styles.rule, { backgroundColor: theme.border }]} />
            <ThemedText type="small" themeColor="textSecondary">
              Invited by your gym?
            </ThemedText>
            <View style={[styles.rule, { backgroundColor: theme.border }]} />
          </View>
          <Button
            label="Enter a code from your email"
            icon="keypad-outline"
            variant="secondary"
            onPress={() => enterCode()}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
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
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + Spacing.half,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  form: {
    gap: Spacing.three,
  },
  notice: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -Spacing.one,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
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
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.75,
  },
});
