import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

/**
 * The camera, looking for QR codes. Calls onScan once per new code it sees.
 * Only load this when the camera's native module is in the build (see
 * hasCameraModule); importing expo-camera without it throws.
 */
export default function QrScanner({ onScan }: { onScan: (data: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  // The camera reports the same code many times a second.
  const last = useRef<string | null>(null);

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Card>
        <ThemedText type="smallBold">Allow the camera to scan</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          CoreFit Gym only uses the camera here to read your gym&apos;s check-in QR.
        </ThemedText>
        {permission.canAskAgain ? (
          <Button label="Allow camera" icon="camera-outline" onPress={requestPermission} />
        ) : (
          <Button
            label="Open settings"
            icon="settings-outline"
            variant="secondary"
            onPress={() => Linking.openSettings()}
          />
        )}
      </Card>
    );
  }

  return (
    <View style={styles.frame}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (data === last.current) return;
          last.current = data;
          onScan(data);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.large,
    overflow: 'hidden',
    marginTop: Spacing.two,
  },
});
