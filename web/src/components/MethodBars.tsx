import type { PaymentSummary } from '../data/rules';
import { formatMoney } from '../lib/format';

/** Each payment method's share of the money collected, as bars. */
export function MethodBars({ summary }: { summary: PaymentSummary }) {
  const top = Math.max(...summary.byMethod.map((m) => m.cents), 1);
  return (
    <div className="grid" style={{ gap: 12 }}>
      {summary.byMethod.map((m) => (
        <div key={m.label} style={{ display: 'grid', gap: 6 }}>
          <div className="card-header" style={{ fontSize: 14 }}>
            <span>
              {m.label} <span className="muted">· {m.count}</span>
            </span>
            <strong>{formatMoney(m.cents, summary.currency)}</strong>
          </div>
          <div className="bar" aria-hidden>
            <span style={{ width: `${(m.cents / top) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
