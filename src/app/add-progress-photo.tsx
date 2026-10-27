import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useUploadPhoto } from '@/features/body/hooks';
import { POSES } from '@/features/body/rules';
import type { PhotoPose } from '@/features/body/types';
import { toIsoDate } from '@/features/memberships/rules';
import { useTheme } from '@/hooks/use-theme';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [3, 4],
  // Keeps uploads to a few hundred KB; plenty for comparing photos on a phone.
  quality: 0.6,
};

type Picked = { uri: string; mimeType: string };

/** Take or pick a progress photo, tag the pose, and upload it to the member's private folder. */
export default function AddProgressPhotoScreen() {
  const theme = useTheme();
  const profile = useProfile();
  const gym = useActiveGym();
  const upload = useUploadPhoto(gym.gymId, profile.id);
  const [pose, setPose] = useState<PhotoPose>('front');
  const [picked, setPicked] = useState<Picked | null>(null);
  const [cameraBlocked, setCameraBlocked] = useState(false);

  const keep = (result: ImagePicker.ImagePickerResult) => {
    const asset = result.canceled ? null : result.assets[0];
    if (asset) setPicked({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setCameraBlocked(true);
      return;
    }
    setCameraBlocked(false);
    keep(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
  };

  // The system photo picker needs no permission.
  const choosePhoto = async () => keep(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));

  return (
    <Screen refreshable={false}>
      <SectionHeader title="Pose" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}>
        {POSES.map((p) => (
          <Chip
            key={p.value}
            label={p.label}
            selected={pose === p.value}
            onPress={() => setPose(p.value)}
          />
        ))}
      </ScrollView>
      <ThemedText type="small" themeColor="textSecondary">
        Same spot, same light and similar clothes each time make changes easy to see.
      </ThemedText>

      {picked ? (
        <View style={[styles.preview, { backgroundColor: theme.backgroundSelected }]}>
          <Image source={{ uri: picked.uri }} style={styles.image} contentFit="cover" />
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Button
            label={picked ? 'Retake' : 'Take photo'}
            icon="camera-outline"
            variant="secondary"
            onPress={takePhoto}
          />
        </View>
        <View style={styles.flex}>
          <Button
            label="From gallery"
            icon="images-outline"
            variant="secondary"
            onPress={choosePhoto}
          />
        </View>
      </View>
      {cameraBlocked ? (
        <>
          <ThemedText type="small" themeColor="warning">
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

      {upload.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t upload: {upload.error.message}</ThemedText>
      ) : null}
      <Button
        label="Save photo"
        icon="cloud-upload-outline"
        disabled={!picked}
        loading={upload.isPending}
        onPress={() =>
          picked &&
          upload.mutate(
            { ...picked, pose, takenOn: toIsoDate(new Date()) },
            { onSuccess: () => router.back() },
          )
        }
      />
      <ThemedText type="small" themeColor="textSecondary">
        Only you, your trainer and the gym&apos;s managers can see your photos.
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  preview: {
    aspectRatio: 3 / 4,
    borderRadius: Radius.large,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
