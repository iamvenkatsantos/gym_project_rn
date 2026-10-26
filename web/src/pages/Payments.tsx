import { useState } from 'react';

import {
  METHOD_LABELS,
  paymentsTable,
  presetPeriod,
  reportFileName,
} from '@/features/reports/rules';

import { useGym } from '../auth/session';
import { MethodBars } from '../components/MethodBars';
import { PeriodPicker } from '../components/PeriodPicker';
import { Empty, PageHeader, QueryState, StatTile } from '../components/ui';
import { usePayments } from '../data/hooks';
import { matchesSearch, summarizePayments } from '../data/rules';
import type { ReportPeriod } from '../data/types';
import { downloadCsv } from '../lib/download';
import { formatDay, formatMoney } from '../lib/format';

export function Payments() {
  const { gym } = useGym();
  const [period, setPeriod] = useState<ReportPeriod>(() => presetPeriod('thisMonth'));
  const [search, setSearch] = useState('');
  const payments = usePayments(gym.gymId, period);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Memberships paid at the front desk, by the day they were recorded">
        <PeriodPicker value={period} onChange={setPeriod} />
        <button
          className="button"
          disabled={!payments.data}
          onClick={() =>
            payments.data &&
            downloadCsv(reportFileName('payments', period), paymentsTable(payments.data))
          }>
          Download CSV
        </button>
      </PageHeader>

      <QueryState query={payments}>
        {(rows) => {
          const summary = summarizePayments(rows);
          const shown = rows.filter((r) =>
            matchesSearch({ fullName: r.memberName, email: r.memberEmail ?? '' }, search),
          );
          return (
            <>
              <section className="grid tiles">
                <StatTile
                  label="Collected"
                  value={formatMoney(summary.totalCents, summary.currency)}
                  note={`${formatDay(period.from)} to ${formatDay(period.to)}`}
                />
                <StatTile label="Payments" value={summary.count} />
                <StatTile
                  label="Average payment"
                  value={
                    summary.count
                      ? formatMoney(
                          Math.round(summary.totalCents / summary.count / 100) * 100,
                          summary.currency,
                        )
                      : '–'
                  }
                />
              </section>

              {summary.byMethod.length > 0 ? (
                <section className="card">
                  <h2>By payment method</h2>
                  <MethodBars summary={summary} />
                </section>
              ) : null}

              <section className="card">
                <div className="card-header">
                  <h2>All payments</h2>
                  <input
                    className="input"
                    type="search"
                    placeholder="Search member"
                    aria-label="Search payments"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {shown.length === 0 ? (
                  <Empty>
                    {rows.length === 0
                      ? 'No payments recorded in this period.'
                      : 'No payments match.'}
                  </Empty>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Paid on</th>
                          <th>Member</th>
                          <th>Plan</th>
                          <th>Covers</th>
                          <th>Method</th>
                          <th className="num">Amount</th>
                          <th>Recorded by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((r, i) => (
                          <tr key={`${r.paidOn}-${r.memberName}-${i}`}>
                            <td>{formatDay(r.paidOn)}</td>
                            <td>
                              {r.memberName}
                              {r.memberEmail ? <span className="sub">{r.memberEmail}</span> : null}
                            </td>
                            <td>
                              {r.planName}
                              {r.note ? <span className="sub">{r.note}</span> : null}
                            </td>
                            <td>
                              {formatDay(r.startsOn)} – {formatDay(r.endsOn)}
                            </td>
                            <td>{r.paymentMethod ? METHOD_LABELS[r.paymentMethod] : '–'}</td>
                            <td className="num">
                              {r.amountPaidCents != null
                                ? formatMoney(r.amountPaidCents, r.currency)
                                : '–'}
                            </td>
                            <td>{r.recordedBy || '–'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          );
        }}
      </QueryState>
    </>
  );
}
