import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { PHOTO_PICKER_OPTIONS } from '@/features/body/rules';
import type { PhotoPose } from '@/features/body/types';
import { ONBOARDING_POSES } from '@/features/onboarding/rules';
import type { PickedPhoto } from '@/features/onboarding/types';
import { useTheme } from '@/hooks/use-theme';

/**
 * The front, back and side photo slots of the first-sign-in form, also on the
 * invite form when the inviter fills in a member's details. Tapping a slot offers
 * the camera or the gallery.
 */
export function StartingPhotos({
  uriFor,
  onPick,
  highlightMissing,
}: {
  /** The photo to show in a slot: one just picked, or one already uploaded. */
  uriFor: (pose: PhotoPose) => string | undefined;
  onPick: (pose: PhotoPose, photo: PickedPhoto) => void;
  /** Outline empty slots in red, once the form has been sent. */
  highlightMissing?: boolean;
}) {
  const theme = useTheme();
  const [cameraBlocked, setCameraBlocked] = useState(false);

  const keep = (pose: PhotoPose, result: ImagePicker.ImagePickerResult) => {
    const asset = result.canceled ? null : result.assets[0];
    if (asset) onPick(pose, { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const takePhoto = async (pose: PhotoPose) => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setCameraBlocked(true);
      return;
    }
    setCameraBlocked(false);
    keep(pose, await ImagePicker.launchCameraAsync(PHOTO_PICKER_OPTIONS));
  };

  // The system photo picker needs no permission.
  const choosePhoto = async (pose: PhotoPose) =>
    keep(pose, await ImagePicker.launchImageLibraryAsync(PHOTO_PICKER_OPTIONS));

  const askForPhoto = (pose: PhotoPose, label: string) =>
    Alert.alert(`${label} photo`, undefined, [
      { text: 'Take photo', onPress: () => takePhoto(pose) },
      { text: 'From gallery', onPress: () => choosePhoto(pose) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <>
      <View style={styles.row}>
        {ONBOARDING_POSES.map(({ value: pose, label }) => {
          const uri = uriFor(pose);
          const done = !!uri;
          return (
            <Pressable
              key={pose}
              accessibilityRole="button"
              accessibilityLabel={done ? `Change ${label} photo` : `Add ${label} photo`}
              onPress={() => askForPhoto(pose, label)}
              style={({ pressed }) => [
                styles.slot,
                {
                  backgroundColor: theme.backgroundSelected,
                  borderColor: highlightMissing && !done ? theme.danger : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              {uri ? (
                <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Icon name="camera-outline" size={28} />
              )}
              <View style={[styles.slotLabel, { backgroundColor: theme.backgroundElement }]}>
                {done ? <Icon name="checkmark-circle" size={16} color="accent" /> : null}
                <ThemedText type="smallBold">{label}</ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
      {cameraBlocked ? (
        <>
          <ThemedText type="small" themeColor="warning">
            CoreFit can&apos;t use the camera. Allow it in Settings, or pick from the gallery.
          </ThemedText>
          <Button
            label="Open Settings"
            variant="secondary"
            size="compact"
            onPress={() => Linking.openSettings()}
          />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  slot: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: {
    position: 'absolute',
    bottom: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    borderRadius: Radius.small,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});
