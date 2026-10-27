import { useState } from 'react';

import { checkInLink } from '@/features/check-in/rules';

import { useGym } from '../auth/session';
import { PageHeader, QueryState } from '../components/ui';
import { QrSvg } from '../components/QrSvg';
import { useCheckInQr } from '../data/hooks';
import { displayUrl } from '../lib/route';

/**
 * The branch's check-in QR: a link for the live front-desk display, and the
 * printable poster. QR-only, auto check-out and resets live in the app.
 */
export function CheckIn() {
  const { gym } = useGym();
  const query = useCheckInQr(gym.gymId);
  const [copied, setCopied] = useState(false);

  return (
    <>
      <PageHeader
        title="Check-in QR"
        subtitle="Members and trainers scan it to check in, and again to check out"
      />
      <QueryState query={query}>
        {(qr) => {
          const url = displayUrl(qr.displayKey);
          return (
            <section className="grid two-col">
              <div className="card">
                <div>
                  <h2>Live QR at the front desk</h2>
                  <p className="muted">
                    The safest option. The code changes every 30 seconds, so a photo sent to a
                    friend stops working almost at once. Open this link on a tablet, old phone or TV
                    at the desk. It needs no sign-in, so your account stays off the shared screen.
                  </p>
                </div>
                <div className="toolbar">
                  <a className="button primary" href={url} target="_blank" rel="noreferrer">
                    Open live display
                  </a>
                  <button
                    className="button"
                    onClick={() =>
                      navigator.clipboard.writeText(url).then(
                        () => setCopied(true),
                        () => setCopied(false),
                      )
                    }>
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
                <p className="muted">
                  If the link gets out, reset it in the app: Attendance → Check-in QR.
                </p>
              </div>

              <div className="card">
                <div>
                  <h2>Printed poster</h2>
                  <p className="muted">
                    {qr.posterEnabled
                      ? 'Simpler than a screen, but a photo of it works from anywhere. Reset it in the app if it gets shared.'
                      : 'The poster is switched off in the app, so only the live QR works.'}
                  </p>
                </div>
                {qr.posterEnabled ? (
                  <>
                    <div className="poster">
                      <h2>{qr.gymName}</h2>
                      <QrSvg
                        value={checkInLink({ gymId: gym.gymId, code: qr.posterCode })}
                        label={`Check-in QR for ${qr.gymName}`}
                      />
                      <p>
                        <strong>Scan to check in. Scan again when you leave.</strong>
                      </p>
                      <p className="muted">Use the CoreFit Gym app or your phone’s camera.</p>
                    </div>
                    <div className="toolbar">
                      <button className="button primary" onClick={() => window.print()}>
                        Print poster
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          );
        }}
      </QueryState>
    </>
  );
}
