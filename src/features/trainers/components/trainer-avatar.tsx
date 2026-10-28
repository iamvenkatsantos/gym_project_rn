import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { initials } from '@/features/trainers/rules';
import { useTheme } from '@/hooks/use-theme';

/** A round profile photo, or the person's initials when they haven't added one. */
export function TrainerAvatar({
  name,
  url,
  size = 48,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, borderColor: theme.accent },
      ]}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <ThemedText type="smallBold" themeColor="accent">
          {initials(name)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
