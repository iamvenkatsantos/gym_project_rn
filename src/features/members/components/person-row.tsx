import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Pill, type PillTone } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { isSignedUp } from '@/features/members/rules';
import type { GymPerson } from '@/features/members/types';
import { initials } from '@/features/trainers/rules';
import { useTheme } from '@/hooks/use-theme';

export const roleTone: Record<GymPerson['role'], PillTone> = {
  member: 'neutral',
  trainer: 'success',
  supervisor: 'warning',
  owner: 'accent',
};

export function PersonRow({
  person,
  divider,
  detail,
  hideEmail,
  hideRole,
  onPress,
}: {
  person: GymPerson;
  divider: boolean;
  /** An extra line, e.g. a member's trainers. */
  detail?: string;
  /** For lists where the email is noise, like matching trainers. */
  hideEmail?: boolean;
  /** For lists of one role, where the pill says nothing new. */
  hideRole?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const suspended = person.status === 'suspended';
  // Imported members who haven't joined yet: listed, but not active.
  const invited = !suspended && !isSignedUp(person);
  const dimmed = suspended || invited;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${person.fullName}, ${person.role}${suspended ? ', suspended' : invited ? ', not joined yet' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divider && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth },
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: theme.backgroundSelected },
          dimmed && styles.dimmed,
        ]}>
        {person.avatarUrl ? (
          <Image
            source={{ uri: person.avatarUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <ThemedText type="smallBold">{initials(person.fullName)}</ThemedText>
        )}
      </View>
      <View style={[styles.text, dimmed && styles.dimmed]}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {person.fullName}
        </ThemedText>
        {hideEmail ? null : (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {person.email}
          </ThemedText>
        )}
        {detail ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      <View>
        {suspended ? (
          <Pill label="Suspended" tone="danger" />
        ) : invited ? (
          <Pill label="Invited" tone="warning" />
        ) : hideRole ? null : (
          <Pill label={person.role} tone={roleTone[person.role]} />
        )}
      </View>
      <Icon name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: TapTarget + 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  dimmed: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.6,
  },
});
