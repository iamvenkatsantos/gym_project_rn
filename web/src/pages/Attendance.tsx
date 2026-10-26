import { useState } from 'react';

import { addDays, toIsoDate } from '@/features/memberships/rules';

import { useGym } from '../auth/session';
import { Empty, PageHeader, Pill, QueryState, StatTile } from '../components/ui';
import { useAttendanceReport, useDayAttendance } from '../data/hooks';
import { daysAgo } from '../data/rules';
import { formatDay, formatMinutes, formatTime } from '../lib/format';

const SPANS = [7, 30, 90];

export function Attendance() {
  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Check-ins from the app’s Home screen, for active members and trainers"
      />
      <DayView />
      <SummaryView />
    </>
  );
}

function DayView() {
  const { gym } = useGym();
  const todayIso = toIsoDate(new Date());
  const [day, setDay] = useState(todayIso);
  const query = useDayAttendance(gym.gymId, daysAgo(day));

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>{day === todayIso ? 'Today' : formatDay(day)}</h2>
          <p>Who came in, and when</p>
        </div>
        <div className="toolbar">
          <button
            className="button"
            onClick={() => setDay(addDays(day, -1))}
            aria-label="Previous day">
            ‹
          </button>
          <input
            className="input"
            type="date"
            aria-label="Day"
            value={day}
            max={todayIso}
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
          <button
            className="button"
            onClick={() => setDay(addDays(day, 1))}
            disabled={day >= todayIso}
            aria-label="Next day">
            ›
          </button>
        </div>
      </div>
      <QueryState query={query}>
        {(rows) => {
          const present = rows.filter((r) => r.checkedInAt);
          const members = rows.filter((r) => r.role === 'member');
          const membersIn = present.filter((r) => r.role === 'member');
          return (
            <>
              <div className="grid tiles">
                <StatTile
                  label="Members in"
                  value={`${membersIn.length} / ${members.length}`}
                  note={
                    members.length
                      ? `${Math.round((membersIn.length / members.length) * 100)}% of active members`
                      : undefined
                  }
                />
                <StatTile
                  label="Trainers in"
                  value={present.length - membersIn.length}
                  note={`of ${rows.length - members.length}`}
                />
                <StatTile label="Workouts" value={rows.reduce((sum, r) => sum + r.workouts, 0)} />
              </div>
              {rows.length === 0 ? (
                <Empty>No active members or trainers yet.</Empty>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>In</th>
                        <th>Out</th>
                        <th className="num">Time</th>
                        <th className="num">Workouts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.userId}>
                          <td>{r.fullName}</td>
                          <td>{r.role === 'trainer' ? 'Trainer' : 'Member'}</td>
                          <td>{r.checkedInAt ? formatTime(r.checkedInAt) : <Pill>Absent</Pill>}</td>
                          <td>
                            {r.checkedOutAt ? (
                              formatTime(r.checkedOutAt)
                            ) : r.checkedInAt && day === todayIso ? (
                              <Pill tone="good">In the gym</Pill>
                            ) : (
                              ''
                            )}
                          </td>
                          <td className="num">
                            {r.checkedInAt && r.checkedOutAt
                              ? formatMinutes(
                                  Math.round(
                                    (Date.parse(r.checkedOutAt) - Date.parse(r.checkedInAt)) /
                                      60000,
                                  ),
                                )
                              : ''}
                          </td>
                          <td className="num">{r.checkedInAt ? r.workouts : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          );
        }}
      </QueryState>
    </section>
  );
}

function SummaryView() {
  const { gym } = useGym();
  const [days, setDays] = useState(30);
  const query = useAttendanceReport(gym.gymId, days);

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Regulars and no-shows</h2>
          <p>Days present per person over the last {days} days, today included</p>
        </div>
        <div className="chips" role="group" aria-label="Span">
          {SPANS.map((n) => (
            <button key={n} className="chip" aria-pressed={n === days} onClick={() => setDays(n)}>
              {n} days
            </button>
          ))}
        </div>
      </div>
      <QueryState query={query}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>No active members or trainers yet.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th className="num">Days present</th>
                    <th className="num">Time in gym</th>
                    <th className="num">Workouts</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.userId}>
                      <td>{r.fullName}</td>
                      <td>{r.role === 'trainer' ? 'Trainer' : 'Member'}</td>
                      <td className="num">{r.daysPresent}</td>
                      <td className="num">{formatMinutes(r.minutesInGym)}</td>
                      <td className="num">{r.workouts}</td>
                      <td>
                        {r.lastSeen ? (
                          formatDay(r.lastSeen)
                        ) : (
                          <Pill tone="warn">Not in {days} days</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </QueryState>
    </section>
  );
}
