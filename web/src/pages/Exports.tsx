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
import { errorMessage, PageHeader } from '../components/ui';
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const download = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const table =
        kind === 'payments'
          ? paymentsTable(await listPayments(gym.gymId, period))
          : kind === 'memberships'
            ? membershipsTable(await exportMemberships(gym.gymId))
            : attendanceTable(await exportAttendance(gym.gymId, period));
      downloadCsv(reportFileName(kind, usesPeriod ? period : null), table);
      setMessage({ error: false, text: `Downloaded ${table[1].length} rows.` });
    } catch (err) {
      setMessage({ error: true, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
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
      <div className="toolbar">
        <button className="button primary" onClick={download} disabled={busy}>
          {busy ? 'Preparing…' : 'Download CSV'}
        </button>
        {message ? (
          <span className={message.error ? 'notice error' : 'muted'} role="status">
            {message.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
