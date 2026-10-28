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
import { signInWithPassword } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { acceptInvite, findInviteByCode } from '@/features/members/api';
import { formatInviteCode, isInviteCode, normalizeInviteCode } from '@/features/members/rules';
import {
  firstError,
  MAX_PASSWORD,
  validateName,
  validateNewPassword,
  validatePasswordMatch,
} from '@/lib/validation';

/**
 * Joins a gym with the code from a WhatsApp invite: the link in the message opens
 * this screen with the code filled in. The account is made already confirmed, so
 * there's no email code; the usual first-sign-in details come next.
 */
export default function JoinScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ? formatInviteCode(params.code) : '');
  const [fullName, setFullName] = useState('');
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
  const join = useMutation({
    mutationFn: async () => {
      const email = await acceptInvite(clean, fullName.trim(), password);
      return signInWithPassword(email, password);
    },
    onSuccess: (profile) => {
      useAuthStore.getState().setProfile(profile);
      router.replace('/');
    },
  });

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
              with {found.email}.
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
          <Button
            label="Join"
            icon="arrow-forward"
            disabled={!!firstError(nameError, passwordError, confirmError)}
            loading={join.isPending}
            onPress={() => join.mutate()}
          />
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
