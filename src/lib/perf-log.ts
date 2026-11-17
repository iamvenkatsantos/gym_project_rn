// Dev-only timing for the performance audit. Everything here does nothing unless the build was made
// with EXPO_PUBLIC_PERF_LOG=true. It records only route and API names, milliseconds and sizes:
// no ids, query values, tokens or response bodies leave the phone, and nothing is sent anywhere.
export const perfEnabled = process.env.EXPO_PUBLIC_PERF_LOG === 'true';

export type PerfEntry =
  | { kind: 'request'; name: string; ms: number; kb: number; status: number; at: number }
  | { kind: 'screen'; name: string; ms: number; requests: number; at: number }
  | { kind: 'mark'; name: string; ms: number; at: number };

/** When this file loaded, which is when the JS bundle started running. */
const jsStartedAt = Date.now();

const MAX_ENTRIES = 500;
const entries: PerfEntry[] = [];

/** Keeps the API name only: `rest/gym_people`, `rpc/gym_attendance`, `auth/token`. No query, no ids. */
export function requestName(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0] ?? '';
  const parts = path
    .split('/')
    .filter(Boolean)
    .map((p) => (/^[0-9a-f-]{8,}$/i.test(p) || /^\d+$/.test(p) ? ':id' : p));
  const [area, , ...rest] = parts;
  if (area === 'rest' || area === 'auth' || area === 'functions') {
    // /rest/v1/rpc/name -> rpc/name, /rest/v1/table -> rest/table
    if (area === 'rest' && rest[0] === 'rpc') return `rpc/${rest[1] ?? ''}`;
    return `${area}/${rest.join('/')}`;
  }
  if (area === 'storage') return 'storage';
  return area ?? 'other';
}

type NewEntry = PerfEntry extends infer E ? (E extends PerfEntry ? Omit<E, 'at'> : never) : never;

/** Callers check `perfEnabled` first. */
export function perfRecord(entry: NewEntry): void {
  const full = { ...entry, at: Date.now() } as PerfEntry;
  entries.push(full);
  if (entries.length > MAX_ENTRIES) entries.shift();
  console.log(`[perf] ${JSON.stringify(full)}`);
}

export function perfMark(name: string): void {
  if (!perfEnabled) return;
  perfRecord({ kind: 'mark', name, ms: Date.now() - jsStartedAt });
}

/** Counts API requests that finished since `since` (epoch ms). */
export function requestsSince(since: number): number {
  return entries.filter((e) => e.kind === 'request' && e.at >= since).length;
}

/** Wraps fetch to time each request until its body has arrived. Returns `base` untouched when off. */
export function perfFetch(base: typeof fetch, enabled = perfEnabled): typeof fetch {
  if (!enabled) return base;
  return async (input, init) => {
    const started = Date.now();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const response = await base(input, init);
    const name = requestName(url);
    response
      .clone()
      .arrayBuffer()
      .then((body) =>
        perfRecord({
          kind: 'request',
          name,
          ms: Date.now() - started,
          kb: Math.round((body.byteLength / 1024) * 10) / 10,
          status: response.status,
        }),
      )
      .catch(() => {});
    return response;
  };
}

/** A readable summary to share from Account: screens first, then each API's count and typical time. */
export function perfReport(): string {
  const lines: string[] = ['CoreFit timing log (route and API names only)', ''];
  const marks = entries.filter((e) => e.kind === 'mark');
  for (const m of marks) lines.push(`${m.name}: ${m.ms} ms after JS start`);
  lines.push('', 'Screens (open until every request finished):');
  for (const s of entries) {
    if (s.kind === 'screen') lines.push(`${s.name}: ${s.ms} ms, ${s.requests} requests`);
  }
  const byApi = new Map<string, number[]>();
  const size = new Map<string, number>();
  for (const e of entries) {
    if (e.kind !== 'request') continue;
    byApi.set(e.name, [...(byApi.get(e.name) ?? []), e.ms]);
    size.set(e.name, Math.max(size.get(e.name) ?? 0, e.kb));
  }
  lines.push('', 'Requests (count, median ms, largest KB):');
  for (const [name, list] of byApi) {
    const sorted = [...list].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    lines.push(`${name}: ${list.length}x, ${median} ms, ${size.get(name)} KB`);
  }
  return lines.join('\n');
}

export function resetPerfLog(): void {
  entries.length = 0;
}
