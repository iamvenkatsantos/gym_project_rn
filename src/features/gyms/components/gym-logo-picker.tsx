import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing, withAlpha } from '@/constants/theme';
import { gymLogoUrl } from '@/features/gyms/logo';
import { useAdminGymLogo, useSaveGymLogo } from '@/features/gyms/hooks';
import { AVATAR_PICKER_OPTIONS } from '@/features/profile/rules';
import { alert } from '@/i18n/alert';
import { useTheme } from '@/hooks/use-theme';

const SIZE = 88;

/** Admin only: a branch's logo, shown on the launch screen and Home header for everyone there. */
export function GymLogoPicker({ gymId }: { gymId: string }) {
  const theme = useTheme();
  const current = useAdminGymLogo(gymId);
  const save = useSaveGymLogo(gymId);
  const logoPath = current.data ?? null;
  const logoUrl = gymLogoUrl(logoPath);

  const fail = (e: Error) => alert("Couldn't save the logo", e.message);
  const choose = async () => {
    const result = await ImagePicker.launchImageLibraryAsync(AVATAR_PICKER_OPTIONS);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    save.mutate(
      {
        photo: { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' },
        oldPath: logoPath,
      },
      { onError: fail },
    );
  };

  return (
    <View style={{ gap: Spacing.two }}>
      <SectionHeader title="Gym logo" />
      <ThemedText type="small" style={{ color: theme.textSecondary }}>
        Shown on the launch screen and Home.
      </ThemedText>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={logoUrl ? 'Change gym logo' : 'Add gym logo'}
          onPress={choose}
          disabled={save.isPending}
          style={[
            styles.box,
            { backgroundColor: withAlpha(theme.primary, 0.16), borderColor: theme.border },
          ]}>
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <ThemedText type="smallBold" themeColor="accent">
              Add
            </ThemedText>
          )}
        </Pressable>
        <View style={styles.buttons}>
          <Button
            label={logoUrl ? 'Change logo' : 'Add logo'}
            variant="secondary"
            onPress={choose}
            loading={save.isPending}
          />
          {logoUrl ? (
            <Button
              label="Remove logo"
              variant="secondary"
              disabled={save.isPending}
              onPress={() => save.mutate({ photo: null, oldPath: logoPath }, { onError: fail })}
            />
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  box: {
    width: SIZE,
    height: SIZE,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttons: { flex: 1, gap: Spacing.two },
});
