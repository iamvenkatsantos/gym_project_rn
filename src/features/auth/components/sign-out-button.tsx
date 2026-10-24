import { Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useSignOut } from '@/features/auth/use-sign-out';

export function SignOutButton() {
  const signOut = useSignOut();

  return (
    <Pressable accessibilityRole="button" onPress={signOut} hitSlop={8}>
      <ThemedText type="linkPrimary">Sign out</ThemedText>
    </Pressable>
  );
}
