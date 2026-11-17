-- READ-ONLY database statistics for the performance audit. Paste into the Supabase SQL editor
-- of the project (production is safe: only catalog and statistics views are read, nothing is
-- written, no user data is selected). Save each result grid as CSV into docs/perf/raw/ and send
-- it back. Query text from pg_stat_statements can contain literals: scan before sharing.

-- 1. Top 30 statements by total time
select left(query, 200) as query, calls, round(total_exec_time::numeric, 0) as total_ms,
       round(mean_exec_time::numeric, 2) as mean_ms, round(max_exec_time::numeric, 0) as max_ms, rows
from extensions.pg_stat_statements
order by total_exec_time desc limit 30;

-- 2. Top 30 by mean time (at least 20 calls)
select left(query, 200) as query, calls, round(mean_exec_time::numeric, 2) as mean_ms,
       round(max_exec_time::numeric, 0) as max_ms, rows
from extensions.pg_stat_statements
where calls >= 20 order by mean_exec_time desc limit 30;

-- 3. Cache hit ratio (aim for > 99%)
select 'index' as kind, round(100.0 * sum(idx_blks_hit) / nullif(sum(idx_blks_hit + idx_blks_read), 0), 2) as hit_pct
from pg_statio_user_indexes
union all
select 'table', round(100.0 * sum(heap_blks_hit) / nullif(sum(heap_blks_hit + heap_blks_read), 0), 2)
from pg_statio_user_tables;

-- 4. Table sizes and row estimates
select relname as table, n_live_tup as rows, pg_size_pretty(pg_total_relation_size(relid)) as total,
       seq_scan, idx_scan
from pg_stat_user_tables order by pg_total_relation_size(relid) desc limit 30;

-- 5. Indexes never used since stats reset (candidates only; never drop without checking)
select s.relname as table, s.indexrelname as index, pg_size_pretty(pg_relation_size(s.indexrelid)) as size, s.idx_scan
from pg_stat_user_indexes s join pg_index i on i.indexrelid = s.indexrelid
where s.idx_scan = 0 and not i.indisunique and not i.indisprimary
order by pg_relation_size(s.indexrelid) desc limit 30;

-- 6. Foreign keys with no index on the referencing column (missing-index candidates)
select c.conrelid::regclass as table, c.conname as fk, a.attname as column
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  and not exists (
    select 1 from pg_index i
    where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
order by 1;

-- 7. Tables that are scanned sequentially a lot
select relname as table, seq_scan, seq_tup_read, idx_scan, n_live_tup as rows
from pg_stat_user_tables where seq_scan > 100 and n_live_tup > 1000
order by seq_tup_read desc limit 20;

-- 8. RLS policies that call auth.uid()/helpers without (select ...) (per-row evaluation)
select schemaname, tablename, policyname, cmd,
       (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~ 'auth\.uid\(\)' as calls_auth_uid
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '') || coalesce(with_check, '')) !~ '\(\s*select\s+auth\.uid\(\)'
  and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'auth\.uid\(\)'
order by tablename;
