import { Card } from '@/components/card';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { AttendanceRow } from '@/features/attendance/components/attendance-row';
import {
  attendanceStatus,
  attendanceTimes,
  formatMinutes,
  minutesAtGym,
  sortForDay,
} from '@/features/attendance/rules';
import type { AttendanceEntry } from '@/features/attendance/types';

const pills = {
  inGym: { label: 'In gym', tone: 'success' },
  left: { label: 'Left', tone: 'neutral' },
  notCheckedIn: { label: 'Absent', tone: 'danger' },
} as const;

function detail(entry: AttendanceEntry) {
  const parts = [attendanceTimes(entry)];
  if (entry.checkedInAt) parts.push(formatMinutes(minutesAtGym(entry)));
  if (entry.workouts) parts.push(`${entry.workouts} workout${entry.workouts > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

/**
 * A titled card of people for one day. Trainers are listed whether they came
 * or not; members can be limited to the ones who came.
 */
export function DayAttendanceList({
  title,
  entries,
  presentOnly,
  emptyText,
}: {
  title: string;
  entries: AttendanceEntry[];
  presentOnly?: boolean;
  emptyText: string;
}) {
  const present = entries.filter((e) => e.checkedInAt).length;
  const shown = sortForDay(presentOnly ? entries.filter((e) => e.checkedInAt) : entries);

  return (
    <>
      <SectionHeader title={title} detail={`${present} of ${entries.length} came`} />
      <Card>
        {shown.length ? (
          shown.map((entry, i) => (
            <AttendanceRow
              key={entry.userId}
              name={entry.fullName}
              detail={detail(entry)}
              pill={pills[attendanceStatus(entry)]}
              dimmed={!entry.checkedInAt}
              divider={i > 0}
            />
          ))
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {emptyText}
          </ThemedText>
        )}
      </Card>
    </>
  );
}
