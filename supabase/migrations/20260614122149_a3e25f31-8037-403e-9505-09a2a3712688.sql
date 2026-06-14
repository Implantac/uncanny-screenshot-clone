
-- Add sector/stage tracking to production orders (PCP)
CREATE TYPE public.production_stage AS ENUM ('cad','corte','costura','acabamento','qualidade','expedicao','entregue');

ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS stage public.production_stage NOT NULL DEFAULT 'cad',
  ADD COLUMN IF NOT EXISTS stage_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS started_at date,
  ADD COLUMN IF NOT EXISTS priority smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5);

-- Track stage transitions
CREATE TABLE IF NOT EXISTS public.production_stage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  from_stage public.production_stage,
  to_stage public.production_stage NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_psl_order ON public.production_stage_log(order_id);

GRANT SELECT, INSERT ON public.production_stage_log TO authenticated;
GRANT ALL ON public.production_stage_log TO service_role;

ALTER TABLE public.production_stage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read stage log" ON public.production_stage_log
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owners insert stage log" ON public.production_stage_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

-- Auto-log + bump timestamp when stage changes
CREATE OR REPLACE FUNCTION public.production_orders_stage_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_updated_at := now();
    INSERT INTO public.production_stage_log(order_id, owner_id, from_stage, to_stage)
    VALUES (NEW.id, NEW.owner_id, OLD.stage, NEW.stage);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_po_stage_change ON public.production_orders;
CREATE TRIGGER trg_po_stage_change
  BEFORE UPDATE ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.production_orders_stage_change();

-- Seed stages on existing orders so kanban is populated
UPDATE public.production_orders SET stage = CASE
  WHEN status = 'concluida' THEN 'entregue'::public.production_stage
  WHEN status = 'atrasada'  THEN 'costura'::public.production_stage
  WHEN status = 'em_producao' AND progress >= 80 THEN 'acabamento'::public.production_stage
  WHEN status = 'em_producao' AND progress >= 40 THEN 'costura'::public.production_stage
  WHEN status = 'em_producao' THEN 'corte'::public.production_stage
  ELSE 'cad'::public.production_stage
END;
