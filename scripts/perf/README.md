# CoreFit performance tooling

Read `docs/perf/before-*.md` for results. Tools here are dev-only and never ship in the app.

| File                  | What it does                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `inventory.mjs`       | Lists every `.rpc()`, `.from()` and `functions.invoke()` call with its api function, hooks and screens. Offline. |
| `screen-requests.mjs` | Estimates query hooks (requests) mounted per screen by following imports. Offline.                               |
| `api-bench.mjs`       | Times read APIs per role: 2 warm-ups + 20 runs, p50/p95/max, size, rows.                                         |
| `manifest.mjs`        | The calls the bench makes, and the read-only RPC allow-list for production.                                      |
| `db-stats.sql`        | Read-only statistics queries to paste into the Supabase SQL editor.                                              |

## Running the benchmark

Environment (never commit these): `PERF_API_URL`, `PERF_ANON_KEY` (public anon key, never the
service role key), and `PERF_<ROLE>_EMAIL` / `PERF_<ROLE>_PASSWORD` for OWNER, SUPERVISOR, TRAINER,
MEMBER, ADMIN.

```bash
# develop (seeded; any call, optional edge-function validation probes)
PERF_API_URL=https://<develop-ref>.supabase.co PERF_ANON_KEY=... PERF_OWNER_EMAIL=... \
  node scripts/perf/api-bench.mjs --env develop --edge

# production: read-only, off-peak only (23:00-05:00 IST), through api.vinven.net
# (the owner can add --allow-peak to skip just the time check; run BEFORE and AFTER at the same time of day)
PERF_API_URL=https://api.vinven.net PERF_ANON_KEY=... PERF_OWNER_EMAIL=perf-owner@... \
  node scripts/perf/api-bench.mjs --env production --confirm-off-peak
```

Production guards in code: GET table reads and an allow-list of read-only RPCs only; one request
at a time, 250 ms gap (never below 200); 20 runs; only the `api.vinven.net` URL; only accounts that belong solely to the
"CoreFit Perf Test" gym (checked after sign-in), no admin role without `--allow-admin`; aborts on any HTTP error or p95 over 5 s. Results (`docs/perf/raw/bench-*.json`)
hold API names and timings only. A new read RPC must be added to `READ_RPCS` after checking its
body has no writes.
