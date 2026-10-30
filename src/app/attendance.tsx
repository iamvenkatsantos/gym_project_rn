import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { QueryState } from '@/components/query-state';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { AttendanceRow } from '@/features/attendance/components/attendance-row';
import { DayAttendanceList } from '@/features/attendance/components/day-attendance';
import { useAttendanceReport, useDayAttendance } from '@/features/attendance/hooks';
import { countByRole, dayLabel, formatMinutes } from '@/features/attendance/rules';
import type { AttendanceSummary } from '@/features/attendance/types';

/** How far back the day view goes. */
const MAX_DAYS_BACK = 60;

function DayView({ gymId }: { gymId: string }) {
  const [daysAgo, setDaysAgo] = useState(0);
  const day = useDayAttendance(gymId, daysAgo);
  const counts = day.data ? countByRole(day.data) : undefined;
  const label = day.data?.[0] ? dayLabel(day.data[0].day) : daysAgo ? '…' : 'Today';

  return (
    <>
      <View style={styles.dayPicker}>
        <Button
          label="Earlier"
          icon="chevron-back"
          variant="secondary"
          size="compact"
          disabled={daysAgo >= MAX_DAYS_BACK}
          onPress={() => setDaysAgo((d) => d + 1)}
        />
        <ThemedText type="heading" style={styles.dayLabel}>
          {label}
        </ThemedText>
        <Button
          label="Later"
          icon="chevron-forward"
          variant="secondary"
          size="compact"
          disabled={daysAgo === 0}
          onPress={() => setDaysAgo((d) => d - 1)}
        />
      </View>
      <View style={styles.grid}>
        <StatTile
          label="Members came"
          value={counts?.member.present}
          icon="people"
          accent
          compact
        />
        <StatTile
          label="Trainers came"
          value={counts && `${counts.trainer.present}/${counts.trainer.total}`}
          icon="barbell-outline"
          compact
        />
        {daysAgo === 0 ? (
          <StatTile
            label="In the gym now"
            value={counts && counts.member.inGym + counts.trainer.inGym}
            icon="location-outline"
            compact
          />
        ) : null}
      </View>
      <QueryState
        query={day}
        isEmpty={(list) => list.length === 0}
        emptyText="No members or trainers yet.">
        {(list) => (
          <>
            <DayAttendanceList
              title="Trainers"
              entries={list.filter((e) => e.role === 'trainer')}
              emptyText="No trainers at this gym yet."
            />
            <DayAttendanceList
              title="Members"
              entries={list.filter((e) => e.role === 'member')}
              presentOnly
              emptyText="No members checked in."
            />
          </>
        )}
      </QueryState>
    </>
  );
}

function summaryDetail(s: AttendanceSummary, days: number) {
  const parts = [`${s.daysPresent} of ${days} days`];
  if (s.minutesInGym) parts.push(formatMinutes(s.minutesInGym));
  if (s.role === 'member' && s.workouts) parts.push(`${s.workouts} workouts`);
  return parts.join(' · ');
}

function ReportList({
  title,
  list,
  days,
}: {
  title: string;
  list: AttendanceSummary[];
  days: number;
}) {
  const came = list.filter((s) => s.daysPresent > 0).length;
  return (
    <>
      <SectionHeader title={title} detail={`${came} of ${list.length} came`} />
      <Card>
        {list.length ? (
          list.map((s, i) => (
            <AttendanceRow
              key={s.userId}
              name={s.fullName}
              detail={summaryDetail(s, days)}
              pill={
                s.daysPresent === 0
                  ? { label: 'Didn’t come', tone: 'danger' }
                  : s.lastSeen
                    ? { label: dayLabel(s.lastSeen), tone: 'neutral' }
                    : undefined
              }
              dimmed={s.daysPresent === 0}
              divider={i > 0}
            />
          ))
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Nobody here yet.
          </ThemedText>
        )}
      </Card>
    </>
  );
}

function ReportView({ gymId }: { gymId: string }) {
  const [days, setDays] = useState<'7' | '30'>('7');
  const report = useAttendanceReport(gymId, Number(days));

  return (
    <>
      <SegmentedControl
        options={[
          { value: '7', label: 'Last 7 days' },
          { value: '30', label: 'Last 30 days' },
        ]}
        value={days}
        onChange={setDays}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Days at the gym, time spent (on days they checked out) and finished workouts. The pill shows
        when they last came.
      </ThemedText>
      <QueryState
        query={report}
        isEmpty={(list) => list.length === 0}
        emptyText="No members or trainers yet.">
        {(list) => (
          <>
            <ReportList
              title="Trainers"
              list={list.filter((s) => s.role === 'trainer')}
              days={Number(days)}
            />
            <ReportList
              title="Members"
              list={list.filter((s) => s.role === 'member')}
              days={Number(days)}
            />
          </>
        )}
      </QueryState>
    </>
  );
}

/** Owners' and supervisors' attendance: one day's check-ins, or totals over a period. */
export default function AttendanceScreen() {
  const gym = useActiveGym();
  const [view, setView] = useState<'day' | 'report'>('day');

  return (
    <Screen>
      {/* The QR members and trainers scan, opening hours and the check-in rules. */}
      <Button
        label="Check-in QR and settings"
        icon="qr-code-outline"
        variant="secondary"
        onPress={() => router.push('/check-in-qr')}
      />
      <SegmentedControl
        options={[
          { value: 'day', label: 'By day' },
          { value: 'report', label: 'Report' },
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'day' ? <DayView gymId={gym.gymId} /> : <ReportView gymId={gym.gymId} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
});
