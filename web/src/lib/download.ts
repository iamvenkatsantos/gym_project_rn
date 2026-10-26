import { toCsv, type CsvCell } from '@/features/reports/csv';

/** Saves a CSV built by the shared report rules to the computer's downloads. */
export function downloadCsv(fileName: string, [header, rows]: [string[], CsvCell[][]]) {
  const blob = new Blob([toCsv(header, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
