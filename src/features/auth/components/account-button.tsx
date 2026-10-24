import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon } from '@/components/icon';

export function AccountButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account"
      onPress={() => router.push('/account')}
      hitSlop={12}>
      <Icon name="person-circle-outline" size={26} color="text" />
    </Pressable>
  );
}
