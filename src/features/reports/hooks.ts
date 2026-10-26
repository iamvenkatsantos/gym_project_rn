import { useMutation } from '@tanstack/react-query';

import { exportAttendance, exportMemberships, exportPayments } from '@/features/reports/api';
import { toCsv } from '@/features/reports/csv';
import {
  attendanceTable,
  membershipsTable,
  paymentsTable,
  reportFileName,
} from '@/features/reports/rules';
import { shareCsv } from '@/features/reports/share';
import type { ReportKind, ReportPeriod } from '@/features/reports/types';

async function buildTable(gymId: string, kind: ReportKind, period: ReportPeriod) {
  switch (kind) {
    case 'payments':
      return paymentsTable(await exportPayments(gymId, period));
    case 'memberships':
      return membershipsTable(await exportMemberships(gymId));
    case 'attendance':
      return attendanceTable(await exportAttendance(gymId, period));
  }
}

/**
 * Fetches a report, writes it as CSV and opens the share sheet. Resolves to
 * the number of rows, or 0 without sharing when there's nothing to export.
 */
export function useExportReport(gymId: string) {
  return useMutation({
    mutationFn: async ({ kind, period }: { kind: ReportKind; period: ReportPeriod }) => {
      const [header, rows] = await buildTable(gymId, kind, period);
      if (rows.length === 0) return 0;
      const name = reportFileName(kind, kind === 'memberships' ? null : period);
      await shareCsv(name, toCsv(header, rows));
      return rows.length;
    },
  });
}
