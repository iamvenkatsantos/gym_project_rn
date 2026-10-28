-- Keep pg_cron and pg_net bookkeeping small.
-- Three jobs run every 5-10 minutes, and pg_cron writes a row to cron.job_run_details
-- for every run and never deletes it. A daily job keeps the last 7 days of run history
-- and the last day of pg_net responses (push webhook calls), then lets autovacuum reuse the space.
-- The statements live inside the job text, so plain Postgres (supabase/tests) never runs them.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'corefit-purge-logs',
      '30 3 * * *',
      $job$
        delete from cron.job_run_details where end_time < now() - interval '7 days';
        do $inner$
        begin
          if to_regclass('net._http_response') is not null then
            delete from net._http_response where created < now() - interval '1 day';
          end if;
        end;
        $inner$;
      $job$
    );
  end if;
end;
$$;
