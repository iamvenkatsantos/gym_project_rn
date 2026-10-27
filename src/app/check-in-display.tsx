import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { QrCode } from '@/features/check-in/components/qr-code';
import { useCheckInQr, useDisplayCode } from '@/features/check-in/hooks';
import { checkInLink } from '@/features/check-in/rules';

function useSecondsLeft(until: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return until ? Math.max(0, Math.ceil((Date.parse(until) - now) / 1000)) : undefined;
}

/**
 * The live QR on a spare phone or tablet at the front desk. The code changes
 * every 30 seconds, so a photo of it is no use from home. Keeps the screen on.
 */
export default function CheckInDisplayScreen() {
  useKeepAwake();
  const gym = useActiveGym();
  const qr = useCheckInQr(gym.gymId);
  const live = useDisplayCode(qr.data?.displayKey);
  const secondsLeft = useSecondsLeft(live.data?.refreshAt);
  const { width } = useWindowDimensions();
  const size = Math.min(width - Spacing.three * 2, 520);

  return (
    <Screen>
      <QueryState query={qr}>
        {() => (
          <QueryState query={live}>
            {(code) => (
              <>
                <ThemedText type="title" style={styles.center}>
                  {code.gymName}
                </ThemedText>
                <ThemedText style={styles.center}>
                  Scan with the CoreFit Gym app or your phone&apos;s camera to check in or out.
                </ThemedText>
                <View style={styles.qr}>
                  <QrCode
                    value={checkInLink({ gymId: code.gymId, code: code.code })}
                    size={size}
                    label={`Check-in QR for ${code.gymName}`}
                  />
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  {secondsLeft ? `New code in ${secondsLeft} s` : 'Getting a new code…'}
                </ThemedText>
              </>
            )}
          </QueryState>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  qr: {
    alignItems: 'center',
  },
});
