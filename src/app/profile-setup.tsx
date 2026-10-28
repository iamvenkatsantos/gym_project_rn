import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { useSignOut } from '@/features/auth/use-sign-out';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { useTheme } from '@/hooks/use-theme';

/**
 * The first screen for anyone without a mobile number yet, mostly owners,
 * supervisors and trainers (new members give theirs on their own form). Nothing
 * else in the app opens until it's saved.
 */
export default function ProfileSetupScreen() {
  const theme = useTheme();
  const gym = useActiveGym();
  const signOut = useSignOut();

  return (
    <Screen refreshable={false}>
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: withAlpha(theme.primary, 0.16) }]}>
          <Icon name="person" size={28} color="accent" />
        </View>
        <ThemedText type="heading">Set up your profile</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Add your mobile number so {gym.gymName} can reach you. A photo is optional and helps
          people know who&apos;s who.
        </ThemedText>
      </View>
      <ProfileForm submitLabel="Save and continue" onSaved={() => router.replace('/')} />
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
});
