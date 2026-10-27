import { useEffect, useState } from 'react';

export type Page = 'overview' | 'members' | 'payments' | 'attendance' | 'check-in' | 'exports';

export const PAGES: { value: Page; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'members', label: 'Members' },
  { value: 'payments', label: 'Payments' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'check-in', label: 'Check-in QR' },
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

/**
 * The front-desk display's key when the URL is #/display/<key>. That page
 * needs no sign-in, so a shared tablet never holds the owner's account.
 */
export function displayKeyFromHash(hash = window.location.hash): string | null {
  const match = /^#\/?display\/([0-9a-f]{16,64})$/i.exec(hash);
  return match ? match[1] : null;
}

/** The link to open on the front-desk tablet or TV. */
export function displayUrl(displayKey: string) {
  return `${window.location.origin}${window.location.pathname}#/display/${displayKey}`;
}
