import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { confirm, ConfirmDialogHost } from '@/components/confirm-dialog';

describe('confirm()', () => {
  it('resolves true on confirm and false on cancel', async () => {
    await render(<ConfirmDialogHost />);
    let first!: Promise<boolean>;
    await act(async () => {
      first = confirm({ title: 'Sign out?', confirmLabel: 'Sign out', tone: 'danger' });
    });
    await fireEvent.press(screen.getByText('Sign out'));
    await expect(first).resolves.toBe(true);

    let second!: Promise<boolean>;
    await act(async () => {
      second = confirm({ title: 'Delete?', confirmLabel: 'Delete' });
    });
    await fireEvent.press(screen.getByText('Cancel'));
    await expect(second).resolves.toBe(false);
  });

  it('answers an open dialog no when another one opens', async () => {
    await render(<ConfirmDialogHost />);
    let first!: Promise<boolean>;
    await act(async () => {
      first = confirm({ title: 'One', confirmLabel: 'OK' });
      void confirm({ title: 'Two', confirmLabel: 'OK' });
    });
    await expect(first).resolves.toBe(false);
  });
});
