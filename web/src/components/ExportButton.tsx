import { useState } from 'react';

import { errorMessage } from './ui';

/**
 * A CSV download button. `onExport` builds and saves the file and returns how many rows it
 * holds; the button shows its own busy and error state.
 */
export function ExportButton({
  onExport,
  disabled,
  primary,
  label = 'Download CSV',
}: {
  onExport: () => Promise<number>;
  disabled?: boolean;
  primary?: boolean;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  const run = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const rows = await onExport();
      setMessage({ error: false, text: `Downloaded ${rows} ${rows === 1 ? 'row' : 'rows'}.` });
    } catch (err) {
      setMessage({ error: true, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export">
      <button
        className={primary ? 'button primary' : 'button'}
        onClick={run}
        disabled={disabled || busy}
        aria-busy={busy}>
        {busy ? 'Preparing…' : label}
      </button>
      {message ? (
        <span className={message.error ? 'export-error' : 'muted'} role="status">
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
