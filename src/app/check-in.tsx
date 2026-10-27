import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCheckIn } from '@/features/attendance/hooks';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { hasCameraModule } from '@/features/check-in/camera';
import { useScanCheckIn } from '@/features/check-in/hooks';
import { scanDetail, scanHeadline } from '@/features/check-in/rules';

function done() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Where a branch QR lands: corefit://check-in?gym=…&code=…, from the in-app
 * scanner or the phone's own camera. Checks in, or out if already in.
 */
export default function CheckInScreen() {
  const { gym: gymId, code } = useLocalSearchParams<{ gym?: string; code?: string }>();
  const profile = useProfile();
  const active = useActiveGym();
  const role = active.role === 'trainer' ? 'trainer' : 'member';
  const scan = useScanCheckIn({ id: profile.id, role });
  // Checking out from "already in" uses the scanned branch, not necessarily the active one.
  const checkOut = useCheckIn(gymId ?? active.gymId, profile.id, role);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !gymId || !code) return;
    started.current = true;
    scan.mutate({ gymId, code });
  }, [gymId, code, scan]);

  if (!gymId || !code) {
    return (
      <Screen>
        <ThemedText themeColor="danger">
          That link is missing the gym&apos;s code. Scan the QR at the front desk again.
        </ThemedText>
        <Button label="Done" variant="secondary" onPress={done} />
      </Screen>
    );
  }

  const result = scan.data;
  const checkedOut = checkOut.isSuccess;

  return (
    <Screen>
      {scan.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <ThemedText themeColor="textSecondary">Checking the gym&apos;s code…</ThemedText>
        </View>
      ) : null}

      {result ? (
        <Card highlighted>
          <View style={styles.center}>
            <Icon
              name={checkedOut || result.action === 'out' ? 'log-out-outline' : 'checkmark-circle'}
              size={56}
              color="accent"
            />
            <ThemedText type="title" style={styles.text}>
              {checkedOut ? 'Checked out' : scanHeadline(result)}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.text}>
              {checkedOut ? `${result.gymName}. See you next time!` : scanDetail(result)}
            </ThemedText>
          </View>
        </Card>
      ) : null}

      {scan.error ? (
        <Card>
          <View style={styles.center}>
            <Icon name="alert-circle-outline" size={48} color="danger" />
            <ThemedText type="heading" style={styles.text}>
              Couldn&apos;t check you in
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.text}>
              {scan.error.message}
            </ThemedText>
          </View>
        </Card>
      ) : null}

      {result?.action === 'already_in' && !checkedOut ? (
        <Button
          label="Check out now"
          icon="log-out-outline"
          variant="secondary"
          loading={checkOut.isPending}
          onPress={() => checkOut.mutate('out')}
        />
      ) : null}
      {checkOut.error ? (
        <ThemedText type="small" themeColor="danger">
          Couldn&apos;t check out: {checkOut.error.message}
        </ThemedText>
      ) : null}
      {scan.error && hasCameraModule ? (
        <Button
          label="Scan again"
          icon="scan-outline"
          onPress={() => router.replace('/scan-check-in')}
        />
      ) : null}
      {!scan.isPending ? (
        <Button label="Done" variant={scan.error ? 'secondary' : 'primary'} onPress={done} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  text: {
    textAlign: 'center',
  },
});
