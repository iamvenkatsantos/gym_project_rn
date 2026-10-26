import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useProgressPhotos } from '@/features/body/hooks';
import { beforeAfter, POSES } from '@/features/body/rules';
import type { PhotoPose, ProgressPhoto } from '@/features/body/types';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';

type ProgressPhotosProps = {
  gymId: string;
  memberId: string;
  /** The member's own view: can add photos. */
  editable: boolean;
};

/** A before and after for a pose, then every photo newest first. */
export function ProgressPhotos({ gymId, memberId, editable }: ProgressPhotosProps) {
  const photos = useProgressPhotos(gymId, memberId);
  const [pose, setPose] = useState<PhotoPose>('front');

  return (
    <>
      <SectionHeader title="Progress photos" />
      {editable ? (
        <Button
          label="Add a photo"
          icon="camera-outline"
          variant="secondary"
          onPress={() => router.push('/add-progress-photo')}
        />
      ) : null}
      <QueryState
        query={photos}
        isEmpty={(list) => list.length === 0}
        emptyText={
          editable
            ? 'Take a front, side and back photo now and again to see changes the scale misses.'
            : 'No progress photos yet.'
        }>
        {(list) => {
          const pair = beforeAfter(list, pose);
          return (
            <>
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
              {pair ? (
                <Card>
                  <ThemedText type="smallBold">Before and after</ThemedText>
                  <View style={styles.compare}>
                    <PhotoTile photo={pair.before} memberId={memberId} caption />
                    <PhotoTile photo={pair.after} memberId={memberId} caption />
                  </View>
                </Card>
              ) : null}
              <View style={styles.grid}>
                {list
                  .filter((p) => p.pose === pose)
                  .map((p) => (
                    <PhotoTile key={p.id} photo={p} memberId={memberId} small />
                  ))}
              </View>
              {list.every((p) => p.pose !== pose) ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No {pose} photos yet.
                </ThemedText>
              ) : null}
            </>
          );
        }}
      </QueryState>
    </>
  );
}

type PhotoTileProps = {
  photo: ProgressPhoto;
  memberId: string;
  small?: boolean;
  caption?: boolean;
};

function PhotoTile({ photo, memberId, small, caption }: PhotoTileProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={`${photo.pose} photo, ${formatDate(photo.takenOn)}`}
      onPress={() =>
        router.push({
          pathname: '/progress-photo/[photoId]',
          params: { photoId: photo.id, memberId },
        })
      }
      style={small ? styles.smallTile : styles.flex}>
      <View style={[styles.frame, { backgroundColor: theme.backgroundSelected }]}>
        {photo.url ? (
          <Image
            source={{ uri: photo.url }}
            style={styles.image}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Icon name="image-outline" size={24} />
        )}
      </View>
      {caption ? (
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(photo.takenOn)}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: {
    gap: Spacing.two,
  },
  compare: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
    gap: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  smallTile: {
    width: '31%',
  },
  frame: {
    aspectRatio: 3 / 4,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
