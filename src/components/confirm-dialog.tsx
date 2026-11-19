import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { create } from 'zustand';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ConfirmRequest = {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: IconName;
  /** danger: a red confirm button and icon, for actions like signing out or deleting. */
  tone?: 'default' | 'danger';
};

type ConfirmState = {
  request: (ConfirmRequest & { resolve: (ok: boolean) => void }) | null;
};

const useConfirmStore = create<ConfirmState>(() => ({ request: null }));

/**
 * Asks before an action in the app's own style instead of the system dialog. Resolves true when
 * the person confirms, false when they cancel, tap outside or press back. Needs
 * `ConfirmDialogHost` mounted once (root layout).
 */
export function confirm(request: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    // A dialog already open is answered "no" before the new one shows.
    useConfirmStore.getState().request?.resolve(false);
    useConfirmStore.setState({ request: { ...request, resolve } });
  });
}

function answer(ok: boolean) {
  const { request } = useConfirmStore.getState();
  useConfirmStore.setState({ request: null });
  request?.resolve(ok);
}

export type ConfirmDialogProps = ConfirmRequest & {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * The app's confirm dialog: a dimmed backdrop, a card with an optional icon, a title, a short
 * message and Cancel / confirm buttons. Use it directly where a screen keeps its own state, or
 * call confirm() from anywhere (it draws through ConfirmDialogHost).
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  icon,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  const danger = tone === 'danger';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        style={styles.backdrop}
        onPress={onCancel}>
        {/* Taps on the card don't reach the backdrop. */}
        <Pressable
          accessibilityViewIsModal
          style={[
            styles.card,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
          onPress={() => {}}>
          {icon ? (
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: `${danger ? theme.danger : theme.primary}22` },
              ]}>
              <Icon name={icon} size={28} color={danger ? 'danger' : 'accent'} />
            </View>
          ) : null}
          <ThemedText type="heading" style={styles.center}>
            {title}
          </ThemedText>
          {message ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {message}
            </ThemedText>
          ) : null}
          <View style={styles.buttons}>
            <View style={styles.button}>
              <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
            </View>
            <View style={styles.button}>
              <Button
                label={confirmLabel}
                variant={danger ? 'danger' : 'primary'}
                onPress={onConfirm}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Draws confirm() requests. Mount it once, above the navigator (root layout). */
export function ConfirmDialogHost() {
  const request = useConfirmStore((s) => s.request);
  if (!request) return null;
  const { resolve: _resolve, ...props } = request;
  return (
    <ConfirmDialog
      {...props}
      visible
      onConfirm={() => answer(true)}
      onCancel={() => answer(false)}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: Math.min(MaxContentWidth, 400),
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
  },
  buttons: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  button: {
    flex: 1,
  },
});
