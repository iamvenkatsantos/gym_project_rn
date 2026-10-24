import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useCoachedMembers } from '@/features/members/hooks';
import { initials } from '@/features/trainers/rules';
import { useTheme } from '@/hooks/use-theme';

export default function TrainerMembersScreen() {
  const theme = useTheme();
  const profile = useProfile();
  const gym = useActiveGym();
  const members = useCoachedMembers(gym.gymId, profile.id);

  return (
    <Screen>
      <SectionHeader
        title="Members you coach"
        detail={members.data ? `${members.data.length} total` : undefined}
      />
      <QueryState
        query={members}
        isEmpty={(list) => list.length === 0}
        emptyText="No members yet. Members your gym matches with you show up here.">
        {(list) => (
          <Card>
            {list.map((member, i) => (
              <Pressable
                key={member.id}
                accessibilityRole="button"
                accessibilityLabel={`${member.fullName}'s progress`}
                onPress={() =>
                  router.push({
                    pathname: '/member-progress/[memberId]',
                    params: { memberId: member.id },
                  })
                }
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && {
                    borderTopColor: theme.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="smallBold">{initials(member.fullName)}</ThemedText>
                </View>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">{member.fullName}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {member.plans.length ? member.plans.join(', ') : 'No plan yet'}
                  </ThemedText>
                </View>
                <Icon name="chevron-forward" size={20} />
              </Pressable>
            ))}
          </Card>
        )}
      </QueryState>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: TapTarget + 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
