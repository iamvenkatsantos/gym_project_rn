import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { STATUS_LABELS } from '@/features/reports/rules';

import type { MemberStanding } from '../data/rules';

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children ? <div className="toolbar">{children}</div> : null}
    </header>
  );
}

export function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="card tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {note ? <span className="tile-note">{note}</span> : null}
    </div>
  );
}

const STANDING_TONE: Record<MemberStanding, string> = {
  active: 'good',
  expiringSoon: 'warn',
  expired: 'bad',
  upcoming: '',
  none: '',
};

export function StandingPill({ standing }: { standing: MemberStanding }) {
  const label = standing === 'none' ? 'No membership' : STATUS_LABELS[standing];
  return <span className={`pill ${STANDING_TONE[standing]}`}>{label}</span>;
}

export function Pill({ tone = '', children }: { tone?: string; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Something went wrong. Try again.';
}

/** Shows loading and errors for a query, and the content once it has data. */
export function QueryState<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <p className="muted">Loading…</p>;
  if (query.isError) {
    return (
      <div className="notice error" role="alert">
        {errorMessage(query.error)}{' '}
        <button className="button link" onClick={() => query.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="notice">{children}</div>;
}
