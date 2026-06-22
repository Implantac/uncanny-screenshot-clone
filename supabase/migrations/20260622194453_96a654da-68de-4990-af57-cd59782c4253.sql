
-- MRP config por owner
CREATE TABLE public.mrp_config (
  owner_id uuid PRIMARY KEY,
  service_level numeric NOT NULL DEFAULT 95,         -- 90/95/97/99
  order_cost numeric NOT NULL DEFAULT 10,            -- S (custo por pedido)
  holding_cost_pct numeric NOT NULL DEFAULT 3.9,     -- H em % a.a.
  working_days_per_month integer NOT NULL DEFAULT 22,
  history_days integer NOT NULL DEFAULT 90,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mrp_config TO authenticated;
GRANT ALL ON public.mrp_config TO service_role;

ALTER TABLE public.mrp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages mrp_config" ON public.mrp_config
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TRIGGER update_mrp_config_updated_at BEFORE UPDATE ON public.mrp_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Overrides por item (Z, S, H, lead_time manual etc.)
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS mrp_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS avg_unit_cost numeric;  -- custo médio cacheado para capital empatado
