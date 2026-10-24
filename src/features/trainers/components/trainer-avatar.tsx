import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { initials } from '@/features/trainers/rules';
import { useTheme } from '@/hooks/use-theme';

export function TrainerAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, borderColor: theme.primary },
      ]}>
      <ThemedText type="smallBold" themeColor="primary">
        {initials(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
