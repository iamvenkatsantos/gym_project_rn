import { router } from 'expo-router';
import { lazy, Suspense, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { hasCameraModule } from '@/features/check-in/camera';
import { parseCheckInLink } from '@/features/check-in/rules';

// Loaded only when the build has the camera; importing it otherwise throws.
const QrScanner = lazy(() => import('@/features/check-in/components/qr-scanner'));

/** Members and trainers point the camera at the branch's QR to check in or out. */
export default function ScanCheckInScreen() {
  const [notOurs, setNotOurs] = useState(false);

  if (!hasCameraModule) {
    return (
      <Screen>
        <Card>
          <ThemedText type="smallBold">Use your phone&apos;s camera</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            This version of the app can&apos;t scan yet. Open your phone&apos;s camera (or Google
            Lens), point it at the QR at the front desk and tap the link. CoreFit Gym opens and
            checks you in. The next app update adds scanning here.
          </ThemedText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Point the camera at the QR at the front desk. Scan it when you arrive and again when you
        leave.
      </ThemedText>
      <Suspense fallback={<ActivityIndicator />}>
        <QrScanner
          onScan={(data) => {
            const link = parseCheckInLink(data);
            if (!link) {
              setNotOurs(true);
              return;
            }
            router.replace({ pathname: '/check-in', params: { gym: link.gymId, code: link.code } });
          }}
        />
      </Suspense>
      {notOurs ? (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          That isn&apos;t a CoreFit Gym check-in QR. Scan the one at your gym&apos;s front desk.
        </ThemedText>
      ) : null}
    </Screen>
  );
}
