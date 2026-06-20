CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agenda anterior se existir (idempotente)
SELECT cron.unschedule('pcp-mark-late-ops-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pcp-mark-late-ops-daily');

SELECT cron.schedule(
  'pcp-mark-late-ops-daily',
  '0 11 * * *',  -- 08:00 BRT diariamente
  $$
  SELECT net.http_post(
    url:='https://project--3318cfc8-a95b-4ad3-b0e3-ef230cc84289.lovable.app/api/public/hooks/mark-late-ops',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2bnp3d3F0c2V5bmRhdmh4cWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMjEzMDIsImV4cCI6MjA5Njc5NzMwMn0.XNrkj00L5uRUOs_vKE36Jj5J_4RS_MJ-u3ZM5MHOm4M"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);