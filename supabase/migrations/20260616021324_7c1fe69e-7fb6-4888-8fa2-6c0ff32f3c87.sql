
CREATE TABLE public.erp_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  event_type text NOT NULL,
  entity_type text,
  entity_ref text,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','erro','ignorado')),
  records_affected integer DEFAULT 0,
  payload jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_sync_log TO authenticated;
GRANT ALL ON public.erp_sync_log TO service_role;
ALTER TABLE public.erp_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages erp_sync_log" ON public.erp_sync_log
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX erp_sync_log_owner_created_idx ON public.erp_sync_log(owner_id, created_at DESC);

CREATE TABLE public.erp_integration_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  erp_name text,
  erp_endpoint text,
  webhook_public_id text NOT NULL DEFAULT replace(gen_random_uuid()::text,'-',''),
  active boolean NOT NULL DEFAULT true,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_integration_config TO authenticated;
GRANT ALL ON public.erp_integration_config TO service_role;
ALTER TABLE public.erp_integration_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages erp_integration_config" ON public.erp_integration_config
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER erp_integration_config_set_updated_at
  BEFORE UPDATE ON public.erp_integration_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
