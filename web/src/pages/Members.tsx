import { useMemo, useState } from 'react';

import { daysRemaining, toIsoDate } from '@/features/memberships/rules';
import { membershipsTable, reportFileName } from '@/features/reports/rules';

import { useGym } from '../auth/session';
import { Empty, errorMessage, PageHeader, Pill, QueryState, StandingPill } from '../components/ui';
import { exportMemberships } from '../data/api';
import { useMemberships, usePeople } from '../data/hooks';
import { matchesSearch, memberRows, type MemberRow } from '../data/rules';
import { downloadCsv } from '../lib/download';
import { formatDay, formatMoney } from '../lib/format';

type Filter = 'all' | 'active' | 'renewals' | 'expired' | 'none' | 'suspended';

const FILTERS: { value: Filter; label: string; test: (r: MemberRow) => boolean }[] = [
  { value: 'all', label: 'All', test: (r) => r.status !== 'suspended' },
  {
    value: 'active',
    label: 'Active plan',
    test: (r) => r.status === 'active' && (r.standing === 'active' || r.standing === 'upcoming'),
  },
  {
    value: 'renewals',
    label: 'Expiring soon',
    test: (r) => r.status === 'active' && r.standing === 'expiringSoon',
  },
  {
    value: 'expired',
    label: 'Expired',
    test: (r) => r.status === 'active' && r.standing === 'expired',
  },
  {
    value: 'none',
    label: 'Never paid',
    test: (r) => r.status === 'active' && r.standing === 'none',
  },
  { value: 'suspended', label: 'Suspended', test: (r) => r.status === 'suspended' },
];

export function Members() {
  const { gym } = useGym();
  const people = usePeople(gym.gymId);
  const memberships = useMemberships(gym.gymId);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const rows = useMemo(
    () => (people.data && memberships.data ? memberRows(people.data, memberships.data) : []),
    [people.data, memberships.data],
  );
  const active = FILTERS.find((f) => f.value === filter)!;
  const shown = rows.filter((r) => active.test(r) && matchesSearch(r, search));

  const download = async () => {
    setExporting(true);
    setExportError(null);
    try {
      downloadCsv(
        reportFileName('memberships', null),
        membershipsTable(await exportMemberships(gym.gymId)),
      );
    } catch (err) {
      setExportError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Everyone with a member role, and the plan that decides their standing today">
        <button className="button" onClick={download} disabled={exporting}>
          {exporting ? 'Preparing…' : 'Download CSV'}
        </button>
      </PageHeader>
      {exportError ? (
        <div className="notice error" role="alert">
          {exportError}
        </div>
      ) : null}

      <section className="card">
        <div className="card-header">
          <div className="chips" role="group" aria-label="Filter members">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                className="chip"
                aria-pressed={f.value === filter}
                onClick={() => setFilter(f.value)}>
                {f.label}
                <span className="count">{rows.filter(f.test).length}</span>
              </button>
            ))}
          </div>
          <input
            className="input"
            type="search"
            placeholder="Search name or email"
            aria-label="Search members"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <QueryState query={people}>
          {() => (
            <QueryState query={memberships}>
              {() =>
                shown.length === 0 ? (
                  <Empty>
                    {rows.length === 0
                      ? 'No members yet. Invite members from the CoreFit Gym app.'
                      : 'No members match.'}
                  </Empty>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th>Plan</th>
                          <th>Ends</th>
                          <th>Status</th>
                          <th className="num">Last paid</th>
                          <th>Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((r) => (
                          <tr key={r.id}>
                            <td>
                              {r.fullName}
                              <span className="sub">{r.email}</span>
                            </td>
                            <td>{r.latest?.plan.name ?? '–'}</td>
                            <td>
                              {r.latest ? formatDay(r.latest.endsOn) : '–'}
                              {r.standing === 'expiringSoon' && r.latest ? (
                                <span className="sub">{daysRemaining(r.latest)} days left</span>
                              ) : null}
                            </td>
                            <td>
                              {r.status === 'suspended' ? (
                                <Pill tone="bad">Suspended</Pill>
                              ) : r.status === 'invited' ? (
                                <Pill>Invited</Pill>
                              ) : (
                                <StandingPill standing={r.standing} />
                              )}
                            </td>
                            <td className="num">
                              {r.latest?.amountPaidCents != null
                                ? formatMoney(r.latest.amountPaidCents, r.latest.plan.currency)
                                : '–'}
                            </td>
                            <td>{formatDay(toIsoDate(new Date(r.joinedAt)))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </QueryState>
          )}
        </QueryState>
      </section>
    </>
  );
}
