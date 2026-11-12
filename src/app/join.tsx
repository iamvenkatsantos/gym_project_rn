import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { confirmInviteEmail, resendSignupCode, signInWithPassword } from '@/features/auth/api';
import { ResendCodeButton } from '@/features/auth/components/resend-code-button';
import { markCodeSent } from '@/features/auth/resend';
import { loginLabel } from '@/lib/mobile-login';
import { useAuthStore } from '@/features/auth/auth-store';
import type { Profile } from '@/features/auth/types';
import { acceptInvite, findInviteByCode } from '@/features/members/api';
import { formatInviteCode, isInviteCode, normalizeInviteCode } from '@/features/members/rules';
import {
  firstError,
  MAX_PASSWORD,
  validateName,
  validateNewPassword,
  validateCode,
  validatePasswordMatch,
} from '@/lib/validation';

/**
 * Joins a gym with the code from a WhatsApp invite: the link in the message opens
 * this screen with the code filled in. A mobile sign-in is made already confirmed; a
 * real email gets a 6-digit sign-up code to prove it's theirs. The usual first-sign-in
 * details come next.
 */
export default function JoinScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ? formatInviteCode(params.code) : '');
  // Null until they type, so the name their inviter gave fills in first.
  const [typedName, setFullName] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const clean = normalizeInviteCode(code);
  const complete = isInviteCode(clean);

  const invite = useQuery({
    queryKey: ['invite-by-code', clean],
    queryFn: () => findInviteByCode(clean),
    enabled: complete,
    retry: false,
  });
  const fullName = typedName ?? invite.data?.fullName ?? '';
  // Set once a real email has been sent its sign-up code.
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const signedIn = (profile: Profile) => {
    useAuthStore.getState().setProfile(profile);
    router.replace('/');
  };
  const join = useMutation({
    mutationFn: async () => {
      const result = await acceptInvite(clean, fullName.trim(), password);
      if (result.emailCode) return result.email;
      return signInWithPassword(result.email, password);
    },
    onSuccess: (result) => {
      if (typeof result === 'string') {
        markCodeSent(result);
        setCodeSentTo(result);
      } else signedIn(result);
    },
  });
  const confirmEmail = useMutation({
    mutationFn: () =>
      confirmInviteEmail(codeSentTo ?? '', emailCode.trim(), password, fullName.trim()),
    onSuccess: signedIn,
  });
  const emailCodeError = validateCode(emailCode.trim());

  const found = invite.data;
  const nameError = validateName(fullName);
  const passwordError = validateNewPassword(password);
  const confirmError = validatePasswordMatch(password, confirm);

  return (
    <Screen refreshable={false}>
      <TextField
        label="Invite code"
        icon="keypad-outline"
        placeholder="K7P2-QX4M"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={10}
        value={code}
        onChangeText={(text) => {
          setCode(text.toUpperCase());
          join.reset();
          setCodeSentTo(null);
        }}
        error={
          code && !complete
            ? 'The code has 8 letters and numbers.'
            : complete && invite.data === null
              ? 'Code not found or used. Ask your gym for a new one.'
              : null
        }
      />
      {invite.isFetching ? (
        <ThemedText type="small" themeColor="textSecondary">
          Checking…
        </ThemedText>
      ) : null}
      {invite.error ? <ThemedText themeColor="danger">{invite.error.message}</ThemedText> : null}

      {found ? (
        <>
          <Card highlighted>
            <View style={styles.row}>
              <Icon name="checkmark-circle" size={22} color="accent" />
              <ThemedText type="heading" style={styles.flex}>
                {found.gymName}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Joining as {found.role === 'member' ? 'a member' : `a ${found.role}`}. You’ll sign in
              with {loginLabel(found.email)}.
            </ThemedText>
          </Card>
          <TextField
            label="Your name"
            icon="person-outline"
            placeholder="Full name"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            maxLength={60}
            value={fullName}
            onChangeText={setFullName}
            error={fullName ? nameError : null}
          />
          <TextField
            label="Password"
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
          {join.error ? <ThemedText themeColor="danger">{join.error.message}</ThemedText> : null}
          {codeSentTo ? (
            <>
              <TextField
                label={`Code sent to ${codeSentTo}`}
                icon="mail-outline"
                placeholder="6-digit code"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                value={emailCode}
                onChangeText={setEmailCode}
                error={emailCode ? emailCodeError : null}
              />
              {confirmEmail.error ? (
                <ThemedText themeColor="danger">{confirmEmail.error.message}</ThemedText>
              ) : null}
              <Button
                label="Confirm and join"
                icon="arrow-forward"
                disabled={!!emailCodeError}
                loading={confirmEmail.isPending}
                onPress={() => confirmEmail.mutate()}
              />
              <ResendCodeButton email={codeSentTo} send={resendSignupCode} />
            </>
          ) : (
            <Button
              label="Join"
              icon="arrow-forward"
              disabled={!!firstError(nameError, passwordError, confirmError)}
              loading={join.isPending}
              onPress={() => join.mutate()}
            />
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
