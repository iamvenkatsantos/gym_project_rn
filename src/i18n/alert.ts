import { Alert, type AlertButton, type AlertOptions } from 'react-native';

import { t } from '@/i18n';

/** `Alert.alert` in the app's language: title, message and button names. */
export function alert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions,
) {
  Alert.alert(
    t(title),
    message ? t(message) : message,
    buttons?.map((b) => ({ ...b, text: b.text ? t(b.text) : b.text })),
    options,
  );
}
