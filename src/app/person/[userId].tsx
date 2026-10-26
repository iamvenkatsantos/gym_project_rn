import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Pill } from '@/components/pill';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { canCoach, type Role } from '@/features/auth/types';
import { useActiveGym, useProfile } from '@/features/auth/use-profile';
import { useIsPlatformAdmin } from '@/features/gyms/hooks';
import { useSetTrainer, useTrainerLinks } from '@/features/coaching/hooks';
import { membersOf, trainersOf } from '@/features/coaching/rules';
import type { GymPerson } from '@/features/members/types';
import { roleTone } from '@/features/members/components/person-row';
import { usePeople, useRemovePerson, useUpdatePerson } from '@/features/members/hooks';
import { activeCoaches, coachLabel, isLastActiveOwner } from '@/features/members/rules';
import { TrainerAvatar } from '@/features/trainers/components/trainer-avatar';
import { MembershipRow } from '@/features/memberships/components/membership-card';
import { useMemberships } from '@/features/memberships/hooks';
import { latestByMember } from '@/features/memberships/rules';
import { formatDate } from '@/lib/format';

export default function PersonScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const profile = useProfile();
  const gym = useActiveGym();
  const people = usePeople(gym.gymId);
  const update = useUpdatePerson(gym.gymId);
  const remove = useRemovePerson(gym.gymId);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Only CoreFit Gym admins make someone an owner; the server refuses anyone else.
  const isAdmin = useIsPlatformAdmin().data === true;
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

  // Supervisors see people and map trainers; roles and access stay with owners.
  const isOwner = gym.role === 'owner';
  const lastOwner = isLastActiveOwner(people.data ?? [], person.id);
  const isSelf = person.id === profile.id;
  const suspended = person.status === 'suspended';
  const error = update.error ?? remove.error;

  return (
    <Screen>
      <Stack.Screen options={{ title: person.fullName }} />
      <View style={styles.header}>
        <TrainerAvatar name={person.fullName} size={64} />
        <View style={styles.flex}>
          <ThemedText type="title">{person.fullName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {person.email}
          </ThemedText>
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
          <MemberTrainers gymId={gym.gymId} member={person} people={people.data ?? []} />
        </>
      ) : null}
      {canCoach(person.role) ? <TrainerMembers gymId={gym.gymId} trainerId={person.id} /> : null}

      {isOwner ? (
        <>
          <View style={styles.field}>
            <ThemedText type="label" themeColor="textSecondary">
              Role
            </ThemedText>
            <SegmentedControl<Role>
              options={[
                { value: 'member', label: 'Member' },
                { value: 'trainer', label: 'Trainer' },
                { value: 'supervisor', label: 'Supervisor' },
                ...(isAdmin || person.role === 'owner'
                  ? [{ value: 'owner' as const, label: 'Owner' }]
                  : []),
              ]}
              value={person.role}
              onChange={(role) => {
                // The last owner's role is locked; the note below says why.
                if (role !== person.role && !lastOwner)
                  update.mutate({ userId: person.id, patch: { role } });
              }}
            />
            {person.role === 'trainer' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Trainers show up for 1:1 booking once they set their weekly hours.
              </ThemedText>
            ) : person.role === 'supervisor' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Supervisors record payments, invite members and trainers, and match members with
                trainers. They can also coach members themselves.
              </ThemedText>
            ) : person.role === 'owner' ? (
              <ThemedText type="small" themeColor="textSecondary">
                Owners can do everything, including supervisor and trainer work.
              </ThemedText>
            ) : null}
          </View>

          {lastOwner ? (
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                {isSelf ? 'You are' : 'This is'} the only owner, so this account can&apos;t be
                demoted, suspended or removed. {isAdmin ? 'Make' : 'Ask CoreFit Gym to make'}{' '}
                someone else an owner first.
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
    </View>
  );
}

/** Owners and supervisors pick which trainers a member works with. */
function MemberTrainers({
  gymId,
  member,
  people,
}: {
  gymId: string;
  member: GymPerson;
  people: GymPerson[];
}) {
  const profile = useProfile();
  const links = useTrainerLinks(gymId);
  const setTrainer = useSetTrainer(gymId);
  // Owners and supervisors can coach too, for gyms without (enough) trainers.
  const trainers = activeCoaches(people);
  const assigned = new Set(trainersOf(links.data ?? [], member.id).map((l) => l.trainerId));

  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        Trainers
      </ThemedText>
      {trainers.length ? (
        <View style={styles.chips}>
          {trainers.map((t) => {
            const on = assigned.has(t.id);
            return (
              <Chip
                key={t.id}
                label={`${coachLabel(t, profile.id)} · ${membersOf(links.data ?? [], t.id).length}`}
                selected={on}
                onPress={() =>
                  !setTrainer.isPending &&
                  setTrainer.mutate({ memberId: member.id, trainerId: t.id, assigned: !on })
                }
              />
            );
          })}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Nobody active can coach yet.
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary">
        Tap to add or remove. Pick yourself to train {member.fullName.split(' ')[0]} when
        there&apos;s no trainer free. The number is each trainer&apos;s members. Removing a trainer
        also takes their plans off {member.fullName.split(' ')[0]}.
      </ThemedText>
      {setTrainer.error ? (
        <ThemedText themeColor="danger">{setTrainer.error.message}</ThemedText>
      ) : null}
    </View>
  );
}

function TrainerMembers({ gymId, trainerId }: { gymId: string; trainerId: string }) {
  const links = useTrainerLinks(gymId);
  const members = membersOf(links.data ?? [], trainerId);

  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        Members ({members.length})
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {members.length
          ? members.map((l) => l.memberName).join(', ')
          : 'No members yet. Assign trainers from a member’s page.'}
      </ThemedText>
    </View>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
