import { useState } from 'react';

import {
  attendanceTable,
  membershipsTable,
  paymentsTable,
  presetPeriod,
  reportFileName,
} from '@/features/reports/rules';
import type { ReportKind } from '@/features/reports/types';

import { useGym } from '../auth/session';
import { PeriodPicker } from '../components/PeriodPicker';
import { ExportButton } from '../components/ExportButton';
import { PageHeader } from '../components/ui';
import { exportAttendance, exportMemberships, listPayments } from '../data/api';
import type { ReportPeriod } from '../data/types';
import { downloadCsv } from '../lib/download';

const REPORTS: { kind: ReportKind; title: string; description: string; usesPeriod: boolean }[] = [
  {
    kind: 'payments',
    title: 'Payments',
    description: 'Every payment recorded in the period, with member, plan, amount and method.',
    usesPeriod: true,
  },
  {
    kind: 'memberships',
    title: 'Memberships',
    description: 'Every active member with their latest plan and its status, as of today.',
    usesPeriod: false,
  },
  {
    kind: 'attendance',
    title: 'Attendance',
    description: 'One row per person per day they checked in, with times and workouts.',
    usesPeriod: true,
  },
];

/** The same CSV files the app's Export reports screen shares, saved straight to the computer. */
export function Exports() {
  return (
    <>
      <PageHeader
        title="Exports"
        subtitle="CSV files that open in Excel and Google Sheets. Up to a year at a time."
      />
      <section className="grid two-col">
        {REPORTS.map((r) => (
          <ExportCard key={r.kind} {...r} />
        ))}
      </section>
    </>
  );
}

function ExportCard({
  kind,
  title,
  description,
  usesPeriod,
}: {
  kind: ReportKind;
  title: string;
  description: string;
  usesPeriod: boolean;
}) {
  const { gym } = useGym();
  const [period, setPeriod] = useState<ReportPeriod>(() => presetPeriod('thisMonth'));

  const download = async () => {
    const table =
      kind === 'payments'
        ? paymentsTable(await listPayments(gym.gymId, period))
        : kind === 'memberships'
          ? membershipsTable(await exportMemberships(gym.gymId))
          : attendanceTable(await exportAttendance(gym.gymId, period));
    downloadCsv(reportFileName(kind, usesPeriod ? period : null), table);
    return table[1].length;
  };

  return (
    <div className="card">
      <div>
        <h2>{title}</h2>
        <p className="muted">{description}</p>
      </div>
      {usesPeriod ? (
        <div className="toolbar">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      ) : null}
      <ExportButton primary onExport={download} />
    </div>
  );
}
