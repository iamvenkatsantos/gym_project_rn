import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useSignOut } from '@/features/auth/use-sign-out';
import { useProgressPhotos } from '@/features/body/hooks';
import { PHOTO_PICKER_OPTIONS } from '@/features/body/rules';
import type { PhotoPose } from '@/features/body/types';
import { useCompleteOnboarding } from '@/features/onboarding/hooks';
import {
  firstOnboardingError,
  ONBOARDING_POSES,
  onboardingValues,
  validateOnboarding,
  type OnboardingTexts,
} from '@/features/onboarding/rules';
import type { PickedPhoto } from '@/features/onboarding/types';
import { ProfilePhotoPicker } from '@/features/profile/components/profile-photo-picker';
import { useTheme } from '@/hooks/use-theme';

/**
 * A new member's first screen: their details, weight and height, and a front,
 * back and side photo. Nothing else in the app opens until it's done. The
 * numbers become their first measurement and the photos their first progress
 * photos, so they can see how far they've come later.
 */
export default function OnboardingScreen() {
  const theme = useTheme();
  const profile = useProfile();
  const gym = useActiveGym();
  const signOut = useSignOut();
  const uploaded = useProgressPhotos(gym.gymId, profile.id);
  const complete = useCompleteOnboarding(gym.gymId, profile.id);
  const [texts, setTexts] = useState<OnboardingTexts>({
    fullName: profile.fullName,
    phone: '',
    weight: '',
    height: '',
  });
  const [avatar, setAvatar] = useState<PickedPhoto | null>(null);
  const [picked, setPicked] = useState<Partial<Record<PhotoPose, PickedPhoto>>>({});
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // A photo saved on an earlier try counts, unless they've picked a new one since.
  const uploadedUrl = (pose: PhotoPose) =>
    uploaded.data?.find((p) => p.pose === pose)?.url ?? undefined;
  const hasUploaded = (pose: PhotoPose) => !!uploaded.data?.some((p) => p.pose === pose);
  const posesWithPhoto = new Set(
    ONBOARDING_POSES.map((p) => p.value).filter((pose) => picked[pose] || hasUploaded(pose)),
  );
  const errors = validateOnboarding(texts, posesWithPhoto);
  const problem = firstOnboardingError(errors);

  const set = (key: keyof OnboardingTexts) => (text: string) =>
    setTexts((prev) => ({ ...prev, [key]: text }));

  const keep = (pose: PhotoPose, result: ImagePicker.ImagePickerResult) => {
    const asset = result.canceled ? null : result.assets[0];
    if (asset) {
      setPicked((prev) => ({
        ...prev,
        [pose]: { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' },
      }));
    }
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

  const save = () => {
    setSubmitted(true);
    if (problem) return;
    // Only what isn't on the server yet; a newly picked photo replaces nothing, it's just newer.
    const photos = Object.fromEntries(
      Object.entries(picked).filter(([pose]) => !hasUploaded(pose as PhotoPose)),
    );
    complete.mutate(
      { ...onboardingValues(texts), photos, avatar },
      { onSuccess: () => router.replace('/') },
    );
  };

  return (
    <Screen refreshable={false}>
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: withAlpha(theme.primary, 0.16) }]}>
          <Icon name="person" size={28} color="accent" />
        </View>
        <ThemedText type="heading">Tell us about you</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Welcome to {gym.gymName}! Your trainer uses this to plan your training and track your
          progress. It takes a minute.
        </ThemedText>
      </View>

      <SectionHeader title="Your details" />
      <ProfilePhotoPicker
        name={texts.fullName || profile.fullName}
        uri={avatar?.uri ?? profile.avatarUrl}
        onPick={setAvatar}
        onRemove={avatar ? () => setAvatar(null) : undefined}
      />
      <TextField
        label="Full name"
        value={texts.fullName}
        onChangeText={set('fullName')}
        autoComplete="name"
        textContentType="name"
        maxLength={60}
        error={errors.fullName}
        showError={submitted}
      />
      <TextField
        label="Mobile number"
        placeholder="98765 43210"
        value={texts.phone}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        maxLength={16}
        error={errors.phone}
        showError={submitted}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <TextField
            label="Weight (kg)"
            placeholder="72.5"
            value={texts.weight}
            onChangeText={set('weight')}
            keyboardType="decimal-pad"
            maxLength={5}
            error={errors.weight}
            showError={submitted}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label="Height (cm)"
            placeholder="170"
            value={texts.height}
            onChangeText={set('height')}
            keyboardType="decimal-pad"
            maxLength={5}
            error={errors.height}
            showError={submitted}
          />
        </View>
      </View>

      <SectionHeader title="Starting photos" />
      <ThemedText type="small" themeColor="textSecondary">
        A front, back and side photo to compare with later. Stand in good light in workout clothes.
        Only you, your trainer and the gym&apos;s managers can see them.
      </ThemedText>
      <View style={styles.row}>
        {ONBOARDING_POSES.map(({ value: pose, label }) => {
          const uri = picked[pose]?.uri ?? uploadedUrl(pose);
          const done = !!picked[pose] || hasUploaded(pose);
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
                  borderColor: submitted && !done ? theme.danger : theme.border,
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
      {submitted && errors.photos ? (
        <ThemedText type="small" themeColor="danger">
          {errors.photos}
        </ThemedText>
      ) : null}
      {cameraBlocked ? (
        <>
          <ThemedText type="small" themeColor="warning">
            CoreFit Gym can&apos;t use the camera. Allow it in Settings, or pick photos from your
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

      {complete.error ? (
        <ThemedText themeColor="danger">Couldn&apos;t save: {complete.error.message}</ThemedText>
      ) : null}
      <Button
        label="Save and continue"
        icon="arrow-forward"
        loading={complete.isPending}
        onPress={save}
      />
      <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
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
