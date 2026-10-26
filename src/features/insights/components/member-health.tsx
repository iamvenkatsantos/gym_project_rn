import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type IconName } from '@/components/icon';
import { ListGroup, ListRow } from '@/components/list-row';
import { SectionHeader } from '@/components/section-header';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  AWAY_DAYS,
  daysSince,
  LAPSED_WINDOW_DAYS,
  type MemberHealth,
} from '@/features/insights/rules';
import type { MemberInsight } from '@/features/insights/types';
import { formatDate } from '@/lib/format';

/** Rows shown per list before "and N more". */
const LIST_LIMIT = 5;

function ago(isoDate: string) {
  const days = daysSince(isoDate);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

type MemberListProps = {
  members: MemberInsight[];
  icon: IconName;
  emptyText: string;
  detail: (member: MemberInsight) => string;
  onPress: (member: MemberInsight) => void;
};

/** The first few members, with a row to show the rest. */
function MemberList({ members, icon, emptyText, detail, onPress }: MemberListProps) {
  const [showAll, setShowAll] = useState(false);
  if (members.length === 0) return <ThemedText themeColor="textSecondary">{emptyText}</ThemedText>;
  const shown = showAll ? members : members.slice(0, LIST_LIMIT);

  return (
    <ListGroup>
      {shown.map((m, i) => (
        <ListRow
          key={m.userId}
          label={m.fullName}
          icon={icon}
          detail={detail(m)}
          divider={i > 0}
          onPress={() => onPress(m)}
        />
      ))}
      {shown.length < members.length ? (
        <ListRow
          label={`Show all ${members.length}`}
          icon="chevron-down"
          divider
          onPress={() => setShowAll(true)}
        />
      ) : null}
    </ListGroup>
  );
}

/** Active against lapsed members, and who to call: those not coming in and those who lapsed. */
export function MemberHealthView({ health }: { health: MemberHealth }) {
  const paidShare = health.total > 0 ? Math.round((health.active / health.total) * 100) : 0;

  return (
    <>
      <View style={styles.grid}>
        <StatTile label="Active" value={health.active} icon="people" accent compact />
        <StatTile label="Lapsed" value={health.lapsed} icon="person-remove-outline" compact />
        <StatTile label="No plan yet" value={health.noPlan} icon="help-circle-outline" compact />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {health.total === 0
          ? 'No members yet.'
          : `${paidShare}% of your ${health.total} members are paid up, and ${health.expiringSoon} end within a week.` +
            (health.visitsPerWeek === null
              ? ''
              : ` Active members came ${health.visitsPerWeek} times a week on average over the last 30 days.`)}
      </ThemedText>

      <SectionHeader
        title={`Not seen in ${AWAY_DAYS}+ days`}
        detail={health.away.length ? `${health.away.length} active` : undefined}
      />
      <MemberList
        members={health.away}
        icon="time-outline"
        emptyText="Every active member came in recently."
        detail={(m) => (m.lastVisit ? `Last came ${ago(m.lastVisit)}` : 'Hasn’t checked in yet')}
        onPress={(m) => router.push({ pathname: '/person/[userId]', params: { userId: m.userId } })}
      />

      <SectionHeader
        title="Recently lapsed"
        detail={health.recentlyLapsed.length ? 'Tap to renew' : undefined}
      />
      <MemberList
        members={health.recentlyLapsed}
        icon="refresh"
        emptyText={`Nobody’s membership ended in the last ${LAPSED_WINDOW_DAYS} days.`}
        detail={(m) => (m.endsOn ? `Ended ${formatDate(m.endsOn)}` : '')}
        onPress={(m) =>
          router.push({ pathname: '/record-membership', params: { memberId: m.userId } })
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
});
