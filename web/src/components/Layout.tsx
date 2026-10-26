import type { ReactNode } from 'react';

import { useGym } from '../auth/session';
import { PAGES, type Page } from '../lib/route';

export function Layout({
  page,
  onNavigate,
  onSignOut,
  children,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const { gym, gyms, email, selectGym } = useGym();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div>
            CoreFit Gym
            <small>{gyms.length > 1 ? 'Owner dashboard' : gym.gymName}</small>
          </div>
        </div>
        {gyms.length > 1 ? (
          <select
            className="select"
            aria-label="Gym"
            value={gym.gymId}
            onChange={(e) => selectGym(e.target.value)}>
            {gyms.map((g) => (
              <option key={g.gymId} value={g.gymId}>
                {g.gymName}
              </option>
            ))}
          </select>
        ) : null}
        <nav className="nav" aria-label="Dashboard">
          {PAGES.map((p) => (
            <a
              key={p.value}
              href={`#/${p.value}`}
              aria-current={p.value === page ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(p.value);
              }}>
              {p.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>{email}</span>
          <button className="button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>
      {/* Keyed by gym so switching gyms resets each page's filters. */}
      <main className="main" key={gym.gymId}>
        {children}
      </main>
    </div>
  );
}
