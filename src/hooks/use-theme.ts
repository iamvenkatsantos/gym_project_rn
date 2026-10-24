import { Colors } from '@/constants/theme';

/** The app ships one dark theme; this hook keeps components free to add light mode later. */
export function useTheme() {
  return Colors;
}
