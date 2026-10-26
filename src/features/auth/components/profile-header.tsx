import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing, withAlpha } from '@/constants/theme';
import type { GymRole, Profile } from '@/features/auth/types';
import { useAccountEmail } from '@/features/auth/use-profile';
import { initials } from '@/features/trainers/rules';
import { useTheme } from '@/hooks/use-theme';

const roleLabel: Record<GymRole['role'], string> = {
  member: 'Member',
  trainer: 'Trainer',
  supervisor: 'Supervisor',
  owner: 'Owner',
};

/** Who's signed in and where: initials, name, email, and their role at the gym on screen. */
export function ProfileHeader({ profile, gym }: { profile: Profile; gym: GymRole | null }) {
  const theme = useTheme();
  const email = useAccountEmail();

  return (
    <Card style={styles.card}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: withAlpha(theme.primary, 0.16), borderColor: theme.accent },
        ]}>
        <ThemedText type="heading" themeColor="accent">
          {initials(profile.fullName) || '?'}
        </ThemedText>
      </View>
      <View style={styles.text}>
        <ThemedText type="heading" numberOfLines={1}>
          {profile.fullName}
        </ThemedText>
        {email.data ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {email.data}
          </ThemedText>
        ) : null}
        {gym ? (
          <View style={styles.gym}>
            <Pill label={roleLabel[gym.role]} tone="accent" />
            <View style={styles.gymName}>
              <Icon name="business-outline" size={14} />
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {gym.gymName}
              </ThemedText>
            </View>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four - Spacing.one,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  gym: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  gymName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexShrink: 1,
  },
});
