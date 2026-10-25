import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  getPushPermission,
  pushUnavailableReason,
  registerForPush,
} from '@/features/notifications/push';

/** Shows whether pushes are on for this phone, with a way to turn them on. */
export function PushSettings() {
  const unavailable = pushUnavailableReason();
  const permission = useQuery({
    queryKey: ['push-permission'],
    queryFn: getPushPermission,
    enabled: !unavailable,
    staleTime: 0,
  });
  const turnOn = useMutation({
    mutationFn: () => registerForPush({ ask: true }),
    onSettled: () => permission.refetch(),
  });
  const { refetch } = permission;

  // They may turn pushes on in Settings and come back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refetch();
    });
    return () => sub.remove();
  }, [refetch]);

  const state = !permission.data
    ? 'checking'
    : permission.data.status === 'granted'
      ? 'on'
      : permission.data.canAskAgain
        ? 'off'
        : 'blocked';

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <ThemedText type="smallBold" style={styles.flex}>
          Push notifications
        </ThemedText>
        {!unavailable && state !== 'checking' ? (
          <Pill
            label={state === 'on' ? 'On' : 'Off'}
            tone={state === 'on' ? 'success' : 'neutral'}
          />
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {unavailable ?? 'Class and session reminders, booking changes, memberships and messages.'}
      </ThemedText>
      {!unavailable && (state === 'off' || state === 'blocked') ? (
        <Button
          label={state === 'blocked' ? 'Open settings' : 'Turn on'}
          variant="secondary"
          size="compact"
          icon="notifications-outline"
          loading={turnOn.isPending}
          onPress={() => (state === 'blocked' ? Linking.openSettings() : turnOn.mutate())}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
