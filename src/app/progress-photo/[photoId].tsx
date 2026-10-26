import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { ConfirmDelete } from '@/features/body/components/confirm-delete';
import { useDeletePhoto, useProgressPhotos } from '@/features/body/hooks';
import { POSES } from '@/features/body/rules';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';

/** One progress photo, full width. Only its owner can delete it. */
export default function ProgressPhotoScreen() {
  const { photoId, memberId } = useLocalSearchParams<{ photoId: string; memberId: string }>();
  const theme = useTheme();
  const profile = useProfile();
  const gym = useActiveGym();
  const photos = useProgressPhotos(gym.gymId, memberId);
  const remove = useDeletePhoto(gym.gymId, memberId);
  const photo = photos.data?.find((p) => p.id === photoId);

  if (!photo) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          {photos.isPending ? 'Loading…' : 'This photo was deleted.'}
        </ThemedText>
      </Screen>
    );
  }

  const pose = POSES.find((p) => p.value === photo.pose)?.label ?? photo.pose;

  return (
    <Screen>
      <Stack.Screen options={{ title: `${pose} · ${formatDate(photo.takenOn)}` }} />
      <View style={[styles.frame, { backgroundColor: theme.backgroundSelected }]}>
        {photo.url ? (
          <Image source={{ uri: photo.url }} style={styles.image} contentFit="contain" />
        ) : (
          <Icon name="image-outline" size={32} />
        )}
      </View>
      {memberId === profile.id ? (
        <ConfirmDelete
          label="Delete photo"
          question="Delete this photo? It can't be recovered."
          loading={remove.isPending}
          onConfirm={() => remove.mutate(photo, { onSuccess: () => router.back() })}
        />
      ) : null}
      {remove.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t delete: {remove.error.message}</ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 3 / 4,
    borderRadius: Radius.large,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
