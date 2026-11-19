import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { Icon } from '@/components/icon';
import { useAuthStore } from '@/features/auth/auth-store';
import { TrainerAvatar } from '@/features/trainers/components/trainer-avatar';

/** Header button to Account: the person's photo when they've added one, else the profile icon. */
export function AccountButton() {
  const profile = useAuthStore((s) => s.profile);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Account"
      onPress={() => router.push('/account')}
      hitSlop={12}>
      {profile?.avatarUrl ? (
        <TrainerAvatar name={profile.fullName} url={profile.avatarUrl} size={28} />
      ) : (
        <Icon name="person-circle-outline" size={26} color="text" />
      )}
    </Pressable>
  );
}
