import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { ListGroup, ListRow } from '@/components/list-row';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/constants/legal';
import { AppearancePicker } from '@/features/appearance/components/appearance-picker';
import { deleteAccount } from '@/features/auth/api';
import { selectActiveGym, selectInAdmin, useAuthStore } from '@/features/auth/auth-store';
import { ProfileHeader } from '@/features/auth/components/profile-header';
import { useSignOut } from '@/features/auth/use-sign-out';
import { branchLabel } from '@/features/branches/rules';
import { useCanSetUpGym, useIsPlatformAdmin } from '@/features/gyms/hooks';
import { PushSettings } from '@/features/notifications/components/push-settings';
import { queryClient } from '@/lib/query-client';

export default function AccountScreen() {
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const activeGym = useAuthStore(selectActiveGym);
  const setActiveGym = useAuthStore((s) => s.setActiveGym);
  const inAdmin = useAuthStore(selectInAdmin);
  const setAdminMode = useAuthStore((s) => s.setAdminMode);
  const signOut = useSignOut();
  // Admins, and people an admin invited to run a gym, can set one up from here.
  const canSetUpGym = useCanSetUpGym();
  // CoreFit Gym admins switch between the admin view and any gym they belong to.
  const isAdmin = useIsPlatformAdmin();
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
      <ProfileHeader profile={profile} gym={activeGym} />

      {profile.gyms.length > (isAdmin ? 0 : 1) ? (
        <>
          <SectionHeader title={inAdmin ? 'Open a gym' : 'Your gyms'} />
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
                    {g.brandName && branchLabel(g.gymName, g.brandName) !== g.gymName ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {g.brandName} branch
                      </ThemedText>
                    ) : null}
                    <Pill label={g.role} tone={active ? 'accent' : 'neutral'} />
                  </View>
                  {active ? (
                    <Icon name="checkmark-circle" size={22} color="accent" />
                  ) : (
                    <Icon name="swap-horizontal" size={20} />
                  )}
                </Card>
              </Pressable>
            );
          })}
        </>
      ) : null}

      {canSetUpGym.data ? (
        <Button
          label="Set up another gym"
          icon="add-circle-outline"
          variant="secondary"
          onPress={() => router.push('/set-up-gym')}
        />
      ) : null}

      {isAdmin && !inAdmin ? (
        <ListGroup>
          <ListRow
            label="Back to admin view"
            detail="Owners, branches and what to collect"
            icon="shield-outline"
            onPress={() => {
              setAdminMode(true);
              router.dismissTo('/');
            }}
          />
        </ListGroup>
      ) : null}

      <SectionHeader title="Appearance" />
      <AppearancePicker />

      <SectionHeader title="Notifications" />
      <PushSettings />

      <SectionHeader title="Help and legal" />
      <ListGroup>
        <ListRow
          label="Contact support"
          detail={SUPPORT_EMAIL}
          icon="chatbubble-ellipses-outline"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
        <ListRow
          divider
          label="Privacy policy"
          icon="shield-checkmark-outline"
          onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
        />
        <ListRow
          divider
          label="Terms of service"
          icon="document-text-outline"
          onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
        />
      </ListGroup>

      <SectionHeader title="Account" />
      <ListGroup>
        <ListRow
          label="Edit profile"
          detail="Photo, name and mobile number"
          icon="person-circle-outline"
          onPress={() => router.push('/edit-profile')}
        />
        <ListRow divider label="Sign out" icon="log-out-outline" onPress={signOut} />
      </ListGroup>
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
        <ListGroup>
          <ListRow
            label="Delete account"
            detail="Removes your profile and history for good"
            icon="trash-outline"
            tone="danger"
            onPress={() => setConfirmingDelete(true)}
          />
        </ListGroup>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
        CoreFit Gym {Constants.expoConfig?.version ?? ''}
      </ThemedText>
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
  version: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
