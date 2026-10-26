import { useEffect, useState } from 'react';

export type Page = 'overview' | 'members' | 'payments' | 'attendance' | 'exports';

export const PAGES: { value: Page; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'members', label: 'Members' },
  { value: 'payments', label: 'Payments' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'exports', label: 'Exports' },
];

function readHash(): Page {
  const value = window.location.hash.replace(/^#\/?/, '');
  return PAGES.some((p) => p.value === value) ? (value as Page) : 'overview';
}

/**
 * The open page lives in the URL hash (#/members), so refresh and the back
 * button work on any static host without server rewrites.
 */
export function usePage(): [Page, (page: Page) => void] {
  const [page, setPage] = useState(readHash);
  useEffect(() => {
    const onChange = () => setPage(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return [page, (next) => (window.location.hash = `/${next}`)];
}
