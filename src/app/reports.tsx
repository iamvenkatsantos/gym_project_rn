import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Chip } from '@/components/chip';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useActiveGym } from '@/features/auth/use-profile';
import { useExportReport } from '@/features/reports/hooks';
import { PERIOD_PRESETS, presetPeriod, type PeriodPreset } from '@/features/reports/rules';
import type { ReportKind } from '@/features/reports/types';
import { formatDate } from '@/lib/format';

const REPORTS: { kind: ReportKind; title: string; detail: string; usesPeriod: boolean }[] = [
  {
    kind: 'payments',
    title: 'Payments',
    detail: 'Every payment recorded in the period: member, plan, amount, method and who took it.',
    usesPeriod: true,
  },
  {
    kind: 'memberships',
    title: 'Memberships',
    detail: 'Every active member with their latest plan, end date and status as of today.',
    usesPeriod: false,
  },
  {
    kind: 'attendance',
    title: 'Attendance',
    detail: 'Every check-in in the period: date, name, role, times in and out, and workouts.',
    usesPeriod: true,
  },
];

const EMPTY: Record<ReportKind, string> = {
  payments: 'No payments were recorded in this period.',
  memberships: 'No active members yet.',
  attendance: 'Nobody checked in during this period.',
};

/** Owner only: payments, memberships and attendance as CSV files for Excel or Sheets. */
export default function ReportsScreen() {
  const gym = useActiveGym();
  const [preset, setPreset] = useState<PeriodPreset>('thisMonth');
  const period = presetPeriod(preset);
  const exportReport = useExportReport(gym.gymId);
  const busyKind = exportReport.isPending ? exportReport.variables?.kind : undefined;
  const doneKind = exportReport.isSuccess ? exportReport.variables?.kind : undefined;

  return (
    <Screen>
      <ThemedText type="small" themeColor="textSecondary">
        Reports download as CSV files that open in Excel or Google Sheets. Share them to WhatsApp or
        Gmail, or save them to Drive or Files.
      </ThemedText>

      <SectionHeader
        title="Period"
        detail={`${formatDate(period.from)} – ${formatDate(period.to)}`}
      />
      <View style={styles.chips}>
        {PERIOD_PRESETS.map((p) => (
          <Chip
            key={p.value}
            label={p.label}
            selected={preset === p.value}
            onPress={() => setPreset(p.value)}
          />
        ))}
      </View>

      {REPORTS.map((report) => (
        <Card key={report.kind} style={styles.card}>
          <ThemedText type="heading">{report.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {report.detail}
          </ThemedText>
          <Button
            label={report.usesPeriod ? 'Export for this period' : 'Export current list'}
            icon="share-outline"
            variant="secondary"
            loading={busyKind === report.kind}
            disabled={exportReport.isPending && busyKind !== report.kind}
            onPress={() => exportReport.mutate({ kind: report.kind, period })}
          />
          {doneKind === report.kind && exportReport.data === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {EMPTY[report.kind]}
            </ThemedText>
          ) : null}
          {exportReport.isError && exportReport.variables?.kind === report.kind ? (
            <ThemedText type="small" themeColor="danger">
              Couldn&apos;t export: {exportReport.error.message}
            </ThemedText>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
  },
});
