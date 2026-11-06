import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Saves a CSV in the app's cache and opens the share sheet, so the owner can
 * send it to WhatsApp or Gmail, or save it to Drive or Files. The cache copy
 * is replaced next time and the system may clear it.
 *
 * The file is plain UTF-8 without the byte order mark that `toCsv` adds for
 * desktop Excel: Google Sheets on Android shows the mark as "ï»¿" before the
 * first header.
 */
export async function shareCsv(fileName: string, csv: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing files isn’t available on this device.');
  }
  const file = new File(Paths.cache, fileName);
  await file.write(csv.replace(/^\uFEFF/, ''));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: fileName,
  });
}
