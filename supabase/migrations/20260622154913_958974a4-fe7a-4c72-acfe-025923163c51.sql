ALTER TABLE public.erp_sync_log DROP CONSTRAINT IF EXISTS erp_sync_log_direction_check;
ALTER TABLE public.erp_sync_log DROP CONSTRAINT IF EXISTS erp_sync_log_status_check;
ALTER TABLE public.erp_sync_log ADD CONSTRAINT erp_sync_log_direction_check
  CHECK (direction IN ('in','out','inbound','outbound'));
ALTER TABLE public.erp_sync_log ADD CONSTRAINT erp_sync_log_status_check
  CHECK (status IN ('success','error','skipped','ok','erro','ignorado'));