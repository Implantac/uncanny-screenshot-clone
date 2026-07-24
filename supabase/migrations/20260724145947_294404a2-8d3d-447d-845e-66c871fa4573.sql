
-- 1) Cost history table
CREATE TABLE IF NOT EXISTS public.product_cost_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tech_sheet_id uuid REFERENCES public.tech_sheets(id) ON DELETE SET NULL,
  materials_cost numeric NOT NULL DEFAULT 0,
  labor_cost numeric NOT NULL DEFAULT 0,
  overhead_pct numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  target_cost numeric,
  status text NOT NULL DEFAULT 'ok',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_cost_history TO authenticated;
GRANT ALL ON public.product_cost_history TO service_role;

ALTER TABLE public.product_cost_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_history_owner_select"
  ON public.product_cost_history FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_pch_product_created
  ON public.product_cost_history(product_id, created_at DESC);

-- 2) Trigger: capture snapshot when tech_sheet cost changes
CREATE OR REPLACE FUNCTION public.tech_sheets_snapshot_cost_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target numeric;
  v_status text := 'ok';
  v_diff numeric;
BEGIN
  IF NEW.product_id IS NULL OR NEW.cost_price IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.cost_price IS NOT DISTINCT FROM NEW.cost_price
     AND OLD.materials_cost IS NOT DISTINCT FROM NEW.materials_cost
     AND OLD.labor_cost IS NOT DISTINCT FROM NEW.labor_cost THEN
    RETURN NEW;
  END IF;

  SELECT target_cost INTO v_target
    FROM public.product_target_costs
   WHERE product_id = NEW.product_id
   ORDER BY updated_at DESC LIMIT 1;

  IF v_target IS NOT NULL AND v_target > 0 THEN
    v_diff := ((NEW.cost_price - v_target) / v_target) * 100;
    v_status := CASE
      WHEN v_diff > 5 THEN 'estouro'
      WHEN v_diff > 0 THEN 'atencao'
      ELSE 'ok'
    END;
  ELSE
    v_status := 'sem_meta';
  END IF;

  INSERT INTO public.product_cost_history(
    owner_id, product_id, tech_sheet_id,
    materials_cost, labor_cost, overhead_pct, total_cost,
    target_cost, status, reason
  ) VALUES (
    NEW.owner_id, NEW.product_id, NEW.id,
    COALESCE(NEW.materials_cost, 0),
    COALESCE(NEW.labor_cost, 0),
    COALESCE(NEW.overhead_pct, 0),
    NEW.cost_price,
    v_target,
    v_status,
    CASE WHEN TG_OP = 'INSERT' THEN 'initial'
         WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status:' || NEW.status
         ELSE 'cost_change' END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tech_sheets_snapshot_cost ON public.tech_sheets;
CREATE TRIGGER trg_tech_sheets_snapshot_cost
  AFTER INSERT OR UPDATE OF cost_price, materials_cost, labor_cost, overhead_pct, status
  ON public.tech_sheets
  FOR EACH ROW EXECUTE FUNCTION public.tech_sheets_snapshot_cost_history();

-- 3) Suggested retail price RPC
CREATE OR REPLACE FUNCTION public.suggest_retail_price(_product_id uuid)
RETURNS TABLE(
  current_cost numeric,
  target_margin_pct numeric,
  suggested_price numeric,
  current_retail numeric,
  gap_pct numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_cost numeric;
  v_margin numeric;
  v_retail numeric;
  v_suggested numeric;
BEGIN
  SELECT owner_id INTO v_owner FROM public.products WHERE id = _product_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN RETURN; END IF;

  SELECT cost_price INTO v_cost
    FROM public.tech_sheets
   WHERE product_id = _product_id AND owner_id = v_owner
   ORDER BY (status='aprovada') DESC, updated_at DESC LIMIT 1;

  SELECT target_margin_pct, target_retail_price INTO v_margin, v_retail
    FROM public.product_target_costs
   WHERE product_id = _product_id AND owner_id = v_owner
   ORDER BY updated_at DESC LIMIT 1;

  IF v_cost IS NOT NULL AND v_margin IS NOT NULL AND v_margin < 100 AND v_margin > 0 THEN
    v_suggested := v_cost / (1 - v_margin/100.0);
  END IF;

  current_cost := v_cost;
  target_margin_pct := v_margin;
  suggested_price := v_suggested;
  current_retail := v_retail;
  gap_pct := CASE
    WHEN v_retail IS NOT NULL AND v_suggested IS NOT NULL AND v_retail > 0
    THEN ((v_suggested - v_retail) / v_retail) * 100
    ELSE NULL
  END;
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.suggest_retail_price(uuid) TO authenticated;
