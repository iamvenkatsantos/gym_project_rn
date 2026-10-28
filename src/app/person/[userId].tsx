import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { canCoach, type Role } from '@/features/auth/types';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useIsPlatformAdmin } from '@/features/gyms/hooks';
import { useTrainerLinks } from '@/features/coaching/hooks';
import type { GymPerson } from '@/features/members/types';
import { roleTone } from '@/features/members/components/person-row';
import { usePeople, useRemovePerson, useUpdatePerson } from '@/features/members/hooks';
import { isLastActiveOwner } from '@/features/members/rules';
import { TrainerAvatar } from '@/features/trainers/components/trainer-avatar';
import { MembershipRow } from '@/features/memberships/components/membership-card';
import { useMemberships } from '@/features/memberships/hooks';
import { latestByMember } from '@/features/memberships/rules';
import { formatDate } from '@/lib/format';

/** What each role can do, shown under the role pill. */
const roleNote: Record<Role, string> = {
  member: 'Members check in, follow their plans and log workouts.',
  trainer: 'Trainers show up for 1:1 booking once they set their weekly hours.',
  supervisor:
    'Supervisors record payments, invite members and trainers, and match members with trainers. They can also coach members themselves.',
  owner: 'Owners can do everything, including supervisor and trainer work.',
};

/** Names listed on a coach's card before "and N more". */
const MEMBERS_SHOWN = 5;

/** Who invited (admitted) a member and when, and whether they've filled in their details. */
function Admission({ person }: { person: GymPerson }) {
  if (!person.admittedAt) return null;
  return (
    <Card>
      <ThemedText type="label" themeColor="textSecondary">
        Admission
      </ThemedText>
      <ThemedText>
        {person.admittedByName
          ? `Admitted by ${person.admittedByName} on ${formatDate(person.admittedAt)}`
          : `Admitted on ${formatDate(person.admittedAt)}`}
      </ThemedText>
      {person.onboarded === false ? (
        <ThemedText type="small" themeColor="warning">
          Hasn&apos;t added their details and starting photos yet.
        </ThemedText>
      ) : null}
    </Card>
  );
}

export default function PersonScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const people = usePeople(gym.gymId);
  const update = useUpdatePerson(gym.gymId);
  const remove = useRemovePerson(gym.gymId);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Only CoreFit Gym admins add owners, so they're the ones to ask for a second one.
  const isAdmin = useIsPlatformAdmin();
  const person = people.data?.find((p) => p.id === userId);

  if (!person) {
    return (
      <Screen>
        <ThemedText themeColor="textSecondary">
          {people.isPending ? 'Loading…' : 'This person is no longer at the gym.'}
        </ThemedText>
      </Screen>
    );
  }

  // Supervisors see people and map trainers; access stays with owners. Roles never change
  // once given (the database refuses), so there's no role picker here.
  const isOwner = gym.role === 'owner';
  const lastOwner = isLastActiveOwner(people.data ?? [], person.id);
  const isSelf = person.id === profile.id;
  const suspended = person.status === 'suspended';
  const error = update.error ?? remove.error;

  return (
    <Screen>
      <Stack.Screen options={{ title: person.fullName }} />
      <View style={styles.header}>
        <TrainerAvatar name={person.fullName} url={person.avatarUrl} size={64} />
        <View style={styles.flex}>
          <ThemedText type="title">{person.fullName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {person.email}
          </ThemedText>
          {person.phone ? (
            <ThemedText type="small" themeColor="textSecondary">
              {person.phone}
            </ThemedText>
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            Joined {formatDate(person.joinedAt)}
          </ThemedText>
        </View>
      </View>
      <View style={styles.pills}>
        <Pill label={person.role} tone={roleTone[person.role]} />
        {suspended ? <Pill label="Suspended" tone="danger" icon="ban-outline" /> : null}
        {isSelf ? <Pill label="You" tone="neutral" /> : null}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {roleNote[person.role]} Roles can&apos;t be changed once given.
      </ThemedText>

      {person.role === 'member' ? <Admission person={person} /> : null}
      {person.role === 'member' && !suspended ? (
        <MemberTrainers gymId={gym.gymId} member={person} />
      ) : null}
      {canCoach(person.role) && !suspended ? (
        <TrainerMembers gymId={gym.gymId} coach={person} />
      ) : null}

      {person.role === 'member' && !suspended ? (
        <>
          <MemberMembership gymId={gym.gymId} memberId={person.id} />
          <Button
            label="Workouts, measurements and photos"
            icon="trending-up-outline"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/member-progress/[memberId]',
                params: { memberId: person.id, name: person.fullName },
              })
            }
          />
        </>
      ) : null}

      {isOwner ? (
        <>
          {lastOwner ? (
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                {isSelf ? 'You are' : 'This is'} the only owner, so this account can&apos;t be
                suspended or removed. {isAdmin ? 'Invite' : 'Ask CoreFit Gym to add'} another owner
                first.
              </ThemedText>
            </Card>
          ) : null}
          {error ? <ThemedText themeColor="danger">{error.message}</ThemedText> : null}

          <Button
            label={suspended ? 'Reactivate' : 'Suspend access'}
            icon={suspended ? 'refresh-outline' : 'ban-outline'}
            variant="secondary"
            disabled={lastOwner}
            loading={update.isPending && update.variables?.patch.status !== undefined}
            onPress={() =>
              update.mutate({
                userId: person.id,
                patch: { status: suspended ? 'active' : 'suspended' },
              })
            }
          />
          <ThemedText type="small" themeColor="textSecondary">
            Suspended people keep their account and history but can&apos;t open this gym in the app.
          </ThemedText>

          {confirmRemove ? (
            <Card>
              <ThemedText type="smallBold">
                Remove {person.fullName} from {gym.gymName}?
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Their account and workout history stay. You can invite them again later.
              </ThemedText>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button
                    label="Cancel"
                    variant="secondary"
                    size="compact"
                    onPress={() => setConfirmRemove(false)}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="Remove"
                    variant="danger"
                    size="compact"
                    loading={remove.isPending}
                    onPress={() => remove.mutate(person.id, { onSuccess: () => router.back() })}
                  />
                </View>
              </View>
            </Card>
          ) : (
            <Button
              label="Remove from gym"
              variant="danger"
              size="compact"
              disabled={lastOwner}
              onPress={() => setConfirmRemove(true)}
            />
          )}
        </>
      ) : null}
    </Screen>
  );
}

/** The member's latest membership, and a shortcut to record their next payment. */
function MemberMembership({ gymId, memberId }: { gymId: string; memberId: string }) {
  const memberships = useMemberships(gymId);
  const current = memberships.data ? latestByMember(memberships.data).get(memberId) : undefined;

  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        Membership
      </ThemedText>
      {current ? (
        <MembershipRow membership={current} />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {memberships.isPending ? 'Loading…' : 'No membership yet.'}
        </ThemedText>
      )}
      <Button
        label={current ? 'Renew or record a payment' : 'Record a payment'}
        icon="receipt-outline"
        variant="secondary"
        size="compact"
        onPress={() => router.push({ pathname: '/record-membership', params: { memberId } })}
      />
      <Button
        label="Payment history"
        icon="time-outline"
        variant="secondary"
        size="compact"
        onPress={() =>
          router.push({
            pathname: '/payment-history/[memberId]',
            params: { memberId, name: current?.memberName },
          })
        }
      />
    </View>
  );
}

/** Who trains the member, with one button to change it. */
function MemberTrainers({ gymId, member }: { gymId: string; member: GymPerson }) {
  const links = useTrainerLinks(gymId, { memberId: member.id });
  const trainers = links.data ?? [];

  return (
    <Card>
      <ThemedText type="label" themeColor="textSecondary">
        {trainers.length > 1 ? `Trainers (${trainers.length})` : 'Trainer'}
      </ThemedText>
      {trainers.length ? (
        trainers.map((l) => (
          <View key={l.trainerId} style={styles.trainer}>
            <TrainerAvatar name={l.trainerName} size={36} />
            <ThemedText type="smallBold" style={styles.flex}>
              {l.trainerName}
            </ThemedText>
          </View>
        ))
      ) : (
        <ThemedText type="small" themeColor={links.isPending ? 'textSecondary' : 'warning'}>
          {links.isPending ? 'Loading…' : 'No trainer yet.'}
        </ThemedText>
      )}
      <Button
        label={trainers.length ? 'Change trainers' : 'Assign a trainer'}
        icon="people-outline"
        variant={trainers.length ? 'secondary' : 'primary'}
        size="compact"
        onPress={() =>
          router.push({ pathname: '/member-trainers/[memberId]', params: { memberId: member.id } })
        }
      />
    </Card>
  );
}

/** How many members a coach trains, and a button to add or remove several at once. */
function TrainerMembers({ gymId, coach }: { gymId: string; coach: GymPerson }) {
  const links = useTrainerLinks(gymId, { trainerId: coach.id });
  const members = links.data ?? [];
  const shown = members.slice(0, MEMBERS_SHOWN);

  return (
    <Card>
      <ThemedText type="label" themeColor="textSecondary">
        Members ({members.length})
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {members.length
          ? shown.map((l) => l.memberName).join(', ') +
            (members.length > shown.length ? ` and ${members.length - shown.length} more` : '')
          : links.isPending
            ? 'Loading…'
            : 'No members yet.'}
      </ThemedText>
      <Button
        label={members.length ? 'Add or remove members' : 'Add members'}
        icon="people-outline"
        variant="secondary"
        size="compact"
        onPress={() =>
          router.push({ pathname: '/trainer-members/[trainerId]', params: { trainerId: coach.id } })
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  trainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
