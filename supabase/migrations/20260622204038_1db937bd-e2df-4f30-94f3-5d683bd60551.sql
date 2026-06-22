
-- 1) Fila de recálculo
CREATE TABLE IF NOT EXISTS public.mrp_recalc_queue (
  owner_id uuid PRIMARY KEY,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

GRANT SELECT ON public.mrp_recalc_queue TO authenticated;
GRANT ALL ON public.mrp_recalc_queue TO service_role;

ALTER TABLE public.mrp_recalc_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads its mrp recalc queue"
ON public.mrp_recalc_queue FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- 2) Trigger function: marca owner como dirty após movimentação relevante
CREATE OR REPLACE FUNCTION public.stock_movements_mark_mrp_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.mrp_recalc_queue(owner_id, requested_at, reason)
  VALUES (NEW.owner_id, now(), 'stock_movement:' || NEW.type)
  ON CONFLICT (owner_id) DO UPDATE
    SET requested_at = EXCLUDED.requested_at,
        reason = EXCLUDED.reason;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_stock_movements_mark_mrp_dirty ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_mark_mrp_dirty
AFTER INSERT OR UPDATE ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.stock_movements_mark_mrp_dirty();

-- 3) Também marcar quando ERP espelha estoque (erp_inventory_mirror)
CREATE OR REPLACE FUNCTION public.erp_inventory_mark_mrp_dirty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.owner_id IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.mrp_recalc_queue(owner_id, requested_at, reason)
  VALUES (NEW.owner_id, now(), 'erp_mirror_sync')
  ON CONFLICT (owner_id) DO UPDATE
    SET requested_at = EXCLUDED.requested_at,
        reason = EXCLUDED.reason;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_erp_inventory_mark_mrp_dirty ON public.erp_inventory_mirror;
CREATE TRIGGER trg_erp_inventory_mark_mrp_dirty
AFTER INSERT OR UPDATE ON public.erp_inventory_mirror
FOR EACH ROW
EXECUTE FUNCTION public.erp_inventory_mark_mrp_dirty();

-- 4) Cron a cada 15 min processando a fila
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- remove jobs anteriores com mesmo nome (idempotência)
DO $$
BEGIN
  PERFORM cron.unschedule('mrp-recalc-queue');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'mrp-recalc-queue',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://uncanny-screenshot-clone.lovable.app/api/public/hooks/mrp-recalc',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2bnp3d3F0c2V5bmRhdmh4cWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyMjEzMDIsImV4cCI6MjA5Njc5NzMwMn0.XNrkj00L5uRUOs_vKE36Jj5J_4RS_MJ-u3ZM5MHOm4M'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
