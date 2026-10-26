import { useMemo } from 'react';

import { daysRemaining, toIsoDate } from '@/features/memberships/rules';
import { presetPeriod } from '@/features/reports/rules';

import { useGym } from '../auth/session';
import { MethodBars } from '../components/MethodBars';
import { Empty, PageHeader, QueryState, StandingPill, StatTile } from '../components/ui';
import { useDayAttendance, useMemberships, usePayments, usePeople } from '../data/hooks';
import { lastMonthToDate, memberRows, standingCounts, summarizePayments } from '../data/rules';
import { formatDay, formatMoney, formatTime } from '../lib/format';

const RENEWALS_SHOWN = 8;

export function Overview() {
  const { gym } = useGym();
  const people = usePeople(gym.gymId);
  const memberships = useMemberships(gym.gymId);
  const thisMonth = usePayments(gym.gymId, presetPeriod('thisMonth'));
  const lastMonth = usePayments(gym.gymId, lastMonthToDate());
  const today = useDayAttendance(gym.gymId, 0);

  const rows = useMemo(
    () => (people.data && memberships.data ? memberRows(people.data, memberships.data) : null),
    [people.data, memberships.data],
  );
  const counts = rows ? standingCounts(rows) : null;
  const renewals = (rows ?? [])
    .filter(
      (r) => r.status === 'active' && (r.standing === 'expiringSoon' || r.standing === 'expired'),
    )
    .sort((a, b) => a.latest!.endsOn.localeCompare(b.latest!.endsOn));

  const revenue = thisMonth.data ? summarizePayments(thisMonth.data) : null;
  const previous = lastMonth.data ? summarizePayments(lastMonth.data) : null;
  const present = today.data?.filter((a) => a.checkedInAt) ?? [];
  const inGym = present.filter((a) => !a.checkedOutAt);
  const activeMembers = counts ? counts.active + counts.expiringSoon : null;

  return (
    <>
      <PageHeader title={gym.gymName} subtitle={`Today, ${formatDay(toIsoDate(new Date()))}`} />

      <section className="grid tiles" aria-label="Key numbers">
        <StatTile
          label="Members with an active plan"
          value={activeMembers ?? '–'}
          note={counts ? `${counts.expired} expired · ${counts.none} never paid` : undefined}
        />
        <StatTile
          label="Expiring in 7 days"
          value={counts?.expiringSoon ?? '–'}
          note="Time for a renewal call"
        />
        <StatTile
          label="Collected this month"
          value={revenue ? formatMoney(revenue.totalCents, revenue.currency) : '–'}
          note={
            revenue && previous
              ? `${revenue.count} payments · ${formatMoney(previous.totalCents, previous.currency)} by this day last month`
              : undefined
          }
        />
        <StatTile
          label="Checked in today"
          value={today.data ? present.length : '–'}
          note={today.data ? `${inGym.length} in the gym now` : undefined}
        />
      </section>

      <section className="grid two-col">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Renewals due</h2>
              <p>Expiring within 7 days, or already expired</p>
            </div>
            <a className="button link" href="#/members">
              All members
            </a>
          </div>
          <QueryState query={memberships}>
            {() =>
              renewals.length === 0 ? (
                <Empty>No renewals due. Every active member is paid up.</Empty>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Plan</th>
                        <th>Ends</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {renewals.slice(0, RENEWALS_SHOWN).map((r) => (
                        <tr key={r.id}>
                          <td>{r.fullName}</td>
                          <td>{r.latest!.plan.name}</td>
                          <td>
                            {formatDay(r.latest!.endsOn)}
                            {r.standing === 'expiringSoon' ? (
                              <span className="sub">{daysRemaining(r.latest!)} days left</span>
                            ) : null}
                          </td>
                          <td>
                            <StandingPill standing={r.standing} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </QueryState>
          {renewals.length > RENEWALS_SHOWN ? (
            <p className="muted">
              And {renewals.length - RENEWALS_SHOWN} more on the Members page.
            </p>
          ) : null}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>Today at the gym</h2>
              <p>Updates every minute</p>
            </div>
            <a className="button link" href="#/attendance">
              Attendance
            </a>
          </div>
          <QueryState query={today}>
            {() =>
              present.length === 0 ? (
                <Empty>Nobody has checked in yet today.</Empty>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>In</th>
                        <th>Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {present.map((a) => (
                        <tr key={a.userId}>
                          <td>
                            {a.fullName}
                            {a.role === 'trainer' ? <span className="sub">Trainer</span> : null}
                          </td>
                          <td>{formatTime(a.checkedInAt)}</td>
                          <td>{a.checkedOutAt ? formatTime(a.checkedOutAt) : 'In the gym'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </QueryState>
        </div>
      </section>

      {revenue && revenue.byMethod.length > 0 ? (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>This month by payment method</h2>
              <p>
                {formatMoney(revenue.totalCents, revenue.currency)} from {revenue.count} payments
              </p>
            </div>
            <a className="button link" href="#/payments">
              Payments
            </a>
          </div>
          <MethodBars summary={revenue} />
        </section>
      ) : null}
    </>
  );
}
