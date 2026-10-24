import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Pill } from '@/components/pill';
import { QueryState } from '@/components/query-state';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { canManageGym, type Role } from '@/features/auth/types';
import { useTrainerLinks } from '@/features/coaching/hooks';
import type { TrainerLink } from '@/features/coaching/types';
import { useGymWorkoutLogs } from '@/features/progress/hooks';
import {
  durationMinutes,
  groupByTrainer,
  trainerNamesOf,
  volumeKg,
} from '@/features/progress/rules';
import type { GymWorkoutLog } from '@/features/progress/types';
import { formatRelativeDay } from '@/lib/format';

type Layout = 'latest' | 'byTrainer';

const roleLabel: Record<Role, string> = {
  member: 'Member',
  trainer: 'Trainer',
  supervisor: 'Supervisor',
  owner: 'Owner',
};

/**
 * Other people's workouts, as far as the viewer's role reaches: a trainer sees
 * their members, a supervisor sees trainers and members, an owner sees everyone.
 * Managers also see each member's trainers and can group workouts by trainer.
 */
export function GymHistory({
  gymId,
  viewer,
}: {
  gymId: string;
  viewer: { id: string; role: Role };
}) {
  const manager = canManageGym(viewer.role);
  const logs = useGymWorkoutLogs(gymId, viewer);
  // Managers get every mapping at the gym; trainers only their own.
  const links = useTrainerLinks(gymId);
  const [view, setView] = useState<Layout>('latest');

  return (
    <>
      {manager ? (
        <SegmentedControl
          options={[
            { value: 'latest', label: 'Latest' },
            { value: 'byTrainer', label: 'By trainer' },
          ]}
          value={view}
          onChange={setView}
        />
      ) : null}
      <QueryState
        query={logs}
        isEmpty={(list) => list.length === 0}
        emptyText={
          manager
            ? 'No workouts logged at your gym yet.'
            : 'Workouts your members log show up here.'
        }>
        {(list) => {
          const allLinks = links.data ?? [];
          if (manager && view === 'byTrainer') {
            return groupByTrainer(list, allLinks).map((group) => (
              <View key={group.key} style={styles.group}>
                <SectionHeader
                  title={group.title}
                  detail={`${group.logs.length} workout${group.logs.length === 1 ? '' : 's'}`}
                />
                {group.logs.map((log) => (
                  <GymLogCard
                    key={`${group.key}-${log.clientId}`}
                    log={log}
                    showRole={group.key === 'staff'}
                    links={allLinks}
                    // Under a trainer the heading already says who; only mention any others.
                    groupTrainer={
                      group.key === 'staff' || group.key === 'unassigned' ? undefined : group.title
                    }
                  />
                ))}
              </View>
            ));
          }
          return list.map((log) => (
            <GymLogCard
              key={log.clientId}
              log={log}
              showRole={manager}
              links={manager ? allLinks : undefined}
            />
          ));
        }}
      </QueryState>
    </>
  );
}

type GymLogCardProps = {
  log: GymWorkoutLog;
  showRole: boolean;
  /** Set to label members' workouts with their trainers' names. */
  links?: TrainerLink[];
  /** The trainer whose group this card is listed under. */
  groupTrainer?: string;
};

function trainerLine(trainers: string[], groupTrainer?: string) {
  if (groupTrainer) return trainers.length ? `Also with ${trainers.join(', ')}` : null;
  if (trainers.length === 0) return 'No trainer yet';
  return `${trainers.length > 1 ? 'Trainers' : 'Trainer'}: ${trainers.join(', ')}`;
}

function GymLogCard({ log, showRole, links, groupTrainer }: GymLogCardProps) {
  const volume = volumeKg(log);
  const trainers =
    links && log.personRole === 'member'
      ? trainerLine(
          trainerNamesOf(log.personId, links).filter((name) => name !== groupTrainer),
          groupTrainer,
        )
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${log.personName}: ${log.title}, ${formatRelativeDay(log.completedAt)}`}
      onPress={() =>
        router.push({
          pathname: '/member-progress/[memberId]',
          params: { memberId: log.personId, name: log.personName },
        })
      }
      style={({ pressed }) => pressed && styles.pressed}>
      <Card>
        <View style={styles.row}>
          <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
            {log.personName}
          </ThemedText>
          {showRole && log.personRole !== 'member' ? (
            <Pill label={roleLabel[log.personRole]} tone="accent" />
          ) : null}
          <ThemedText type="small" themeColor="textSecondary">
            {formatRelativeDay(log.completedAt)}
          </ThemedText>
        </View>
        <ThemedText type="heading">{log.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {durationMinutes(log)} min · {log.sets.length} sets
          {volume ? ` · ${Math.round(volume).toLocaleString()} kg lifted` : ''}
        </ThemedText>
        {trainers ? (
          <View style={styles.row}>
            <Icon name="person-outline" size={14} color="textSecondary" />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {trainers}
            </ThemedText>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
