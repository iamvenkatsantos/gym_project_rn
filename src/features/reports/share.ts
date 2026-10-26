import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Saves a CSV in the app's cache and opens the share sheet, so the owner can
 * send it to WhatsApp or Gmail, or save it to Drive or Files. The cache copy
 * is replaced next time and the system may clear it.
 */
export async function shareCsv(fileName: string, csv: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing files isn’t available on this device.');
  }
  const file = new File(Paths.cache, fileName);
  await file.write(csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: fileName,
  });
}
