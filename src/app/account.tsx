import { useMutation } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/constants/legal';
import { deleteAccount } from '@/features/auth/api';
import { selectActiveGym, useAuthStore } from '@/features/auth/auth-store';
import { useSignOut } from '@/features/auth/use-sign-out';
import { queryClient } from '@/lib/query-client';

export default function AccountScreen() {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const activeGym = useAuthStore(selectActiveGym);
  const setActiveGym = useAuthStore((s) => s.setActiveGym);
  const signOut = useSignOut();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const removeAccount = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.clear();
      setProfile(null);
    },
  });

  if (!profile) return null;

  return (
    <Screen>
      <Card>
        <ThemedText type="heading">{profile.fullName}</ThemedText>
        {activeGym ? (
          <ThemedText type="small" themeColor="textSecondary">
            {activeGym.gymName}
          </ThemedText>
        ) : null}
        {activeGym ? <Pill label={activeGym.role} tone="accent" /> : null}
      </Card>

      {profile.gyms.length > 1 ? (
        <>
          <SectionHeader title="Your gyms" />
          {profile.gyms.map((g) => {
            const active = g.gymId === activeGym?.gymId;
            return (
              <Pressable
                key={g.gymId}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Switch to ${g.gymName} as ${g.role}`}
                onPress={() => {
                  setActiveGym(g.gymId);
                  router.dismissTo('/');
                }}>
                <Card highlighted={active} style={styles.gymRow}>
                  <View style={styles.flex}>
                    <ThemedText type="smallBold">{g.gymName}</ThemedText>
                    <Pill label={g.role} tone={active ? 'accent' : 'neutral'} />
                  </View>
                  {active ? (
                    <Icon name="checkmark-circle" size={22} color="primary" />
                  ) : (
                    <Icon name="swap-horizontal" size={20} />
                  )}
                </Card>
              </Pressable>
            );
          })}
        </>
      ) : null}

      <SectionHeader title="Legal" />
      <Button
        label="Privacy policy"
        variant="secondary"
        icon="shield-checkmark-outline"
        onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
      />
      <Button
        label="Terms of service"
        variant="secondary"
        icon="document-text-outline"
        onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Questions? Email {SUPPORT_EMAIL}
      </ThemedText>

      <SectionHeader title="Account" />
      <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} />
      {confirmingDelete ? (
        <Card style={styles.confirm}>
          <ThemedText type="smallBold">Delete your account?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            This permanently removes your profile, bookings and membership history. It can&apos;t be
            undone.
          </ThemedText>
          <View style={styles.confirmActions}>
            <View style={styles.flex}>
              <Button
                label="Keep account"
                variant="secondary"
                size="compact"
                onPress={() => setConfirmingDelete(false)}
              />
            </View>
            <View style={styles.flex}>
              <Button
                label="Delete"
                variant="danger"
                size="compact"
                loading={removeAccount.isPending}
                onPress={() => removeAccount.mutate()}
              />
            </View>
          </View>
          {removeAccount.error ? (
            <ThemedText themeColor="danger">{removeAccount.error.message}</ThemedText>
          ) : null}
        </Card>
      ) : (
        <Button
          label="Delete account"
          variant="danger"
          icon="trash-outline"
          onPress={() => setConfirmingDelete(true)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  confirm: {
    gap: Spacing.three,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    gap: Spacing.one,
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
