import { useEffect, useState } from 'react';

import { checkInLink } from '@/features/check-in/rules';

import { errorMessage } from '../components/ui';
import { QrSvg } from '../components/QrSvg';
import { useDisplayCode } from '../data/hooks';

function useSecondsLeft(until: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return until ? Math.max(0, Math.ceil((Date.parse(until) - now) / 1000)) : undefined;
}

/** The front-desk screen: the live QR, new every 30 seconds. Open signed out on a tablet or TV. */
export function Display({ displayKey }: { displayKey: string }) {
  const query = useDisplayCode(displayKey);
  const secondsLeft = useSecondsLeft(query.data?.refreshAt);

  useEffect(() => {
    // Keep a tablet's screen on where the browser allows it.
    let lock: WakeLockSentinel | undefined;
    const request = () =>
      navigator.wakeLock
        ?.request('screen')
        .then((l) => (lock = l))
        .catch(() => {});
    request();
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  if (query.isError && !query.data) {
    return (
      <main className="display">
        <p className="notice error" role="alert">
          {errorMessage(query.error)}
        </p>
      </main>
    );
  }
  if (!query.data) {
    return (
      <main className="display">
        <p className="muted">Loading…</p>
      </main>
    );
  }
  const code = query.data;
  return (
    <main className="display">
      <h1>{code.gymName}</h1>
      <QrSvg
        className="display-qr"
        value={checkInLink({ gymId: code.gymId, code: code.code })}
        label={`Check-in QR for ${code.gymName}`}
      />
      <p className="display-hint">
        Scan with the CoreFit Gym app or your phone’s camera to check in or out.
      </p>
      <p className="muted">
        {secondsLeft ? `New code in ${secondsLeft} s` : 'Getting a new code…'}
      </p>
    </main>
  );
}
