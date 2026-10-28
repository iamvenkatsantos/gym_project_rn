import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing, withAlpha } from '@/constants/theme';
import type { PickedPhoto } from '@/features/onboarding/types';
import { AVATAR_PICKER_OPTIONS } from '@/features/profile/rules';
import { initials } from '@/features/trainers/rules';
import { useTheme } from '@/hooks/use-theme';

const SIZE = 96;

/**
 * The optional profile photo: a circle with the photo or initials, tapped to take
 * or pick one. onRemove is only passed when there's a photo to remove.
 */
export function ProfilePhotoPicker({
  name,
  uri,
  onPick,
  onRemove,
}: {
  name: string;
  uri: string | null | undefined;
  onPick: (photo: PickedPhoto) => void;
  onRemove?: () => void;
}) {
  const theme = useTheme();
  const [cameraBlocked, setCameraBlocked] = useState(false);

  const keep = (result: ImagePicker.ImagePickerResult) => {
    const asset = result.canceled ? null : result.assets[0];
    if (asset) onPick({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setCameraBlocked(true);
      return;
    }
    setCameraBlocked(false);
    keep(
      await ImagePicker.launchCameraAsync({
        ...AVATAR_PICKER_OPTIONS,
        cameraType: ImagePicker.CameraType.front,
      }),
    );
  };

  // The system photo picker needs no permission.
  const choosePhoto = async () =>
    keep(await ImagePicker.launchImageLibraryAsync(AVATAR_PICKER_OPTIONS));

  const ask = () =>
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: takePhoto },
      { text: 'From gallery', onPress: choosePhoto },
      ...(onRemove
        ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: onRemove }]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uri ? 'Change profile photo' : 'Add profile photo'}
        onPress={ask}
        style={({ pressed }) => [pressed && styles.pressed]}>
        <View
          style={[
            styles.circle,
            { backgroundColor: withAlpha(theme.primary, 0.16), borderColor: theme.accent },
          ]}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <ThemedText type="heading" themeColor="accent">
              {initials(name) || '?'}
            </ThemedText>
          )}
        </View>
        <View
          style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.background }]}>
          <Icon name="camera" size={16} color="onPrimary" />
        </View>
      </Pressable>
      <Button
        label={uri ? 'Change photo' : 'Add a photo (optional)'}
        variant="secondary"
        size="compact"
        onPress={ask}
      />
      {cameraBlocked ? (
        <>
          <ThemedText type="small" themeColor="warning" style={styles.center}>
            CoreFit Gym can&apos;t use the camera. Allow it in Settings, or pick a photo from your
            gallery.
          </ThemedText>
          <Button
            label="Open Settings"
            variant="secondary"
            size="compact"
            onPress={() => Linking.openSettings()}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
