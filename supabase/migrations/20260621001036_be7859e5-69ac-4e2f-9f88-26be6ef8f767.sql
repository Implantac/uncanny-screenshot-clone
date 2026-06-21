
-- ============================================================
-- Fase 5 · Almoxarifado FEFO + Scraps
-- ============================================================

-- 1) inventory_lots
CREATE TABLE IF NOT EXISTS public.inventory_lots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  lot_code text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  expires_at date,
  status text NOT NULL DEFAULT 'ativo',
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_lots_item_idx ON public.inventory_lots(inventory_item_id, expires_at NULLS LAST);
CREATE INDEX IF NOT EXISTS inventory_lots_owner_idx ON public.inventory_lots(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_lots TO authenticated;
GRANT ALL ON public.inventory_lots TO service_role;
ALTER TABLE public.inventory_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lots_select_own" ON public.inventory_lots FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "lots_insert_own" ON public.inventory_lots FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "lots_update_own" ON public.inventory_lots FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "lots_delete_own" ON public.inventory_lots FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER update_inventory_lots_updated_at
  BEFORE UPDATE ON public.inventory_lots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) inventory_scraps
CREATE TABLE IF NOT EXISTS public.inventory_scraps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES public.inventory_lots(id) ON DELETE SET NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  reason text NOT NULL,
  cost_value numeric,
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  notes text,
  registered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_scraps_item_idx ON public.inventory_scraps(inventory_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_scraps_owner_idx ON public.inventory_scraps(owner_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_scraps TO authenticated;
GRANT ALL ON public.inventory_scraps TO service_role;
ALTER TABLE public.inventory_scraps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scraps_select_own" ON public.inventory_scraps FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "scraps_insert_own" ON public.inventory_scraps FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "scraps_update_own" ON public.inventory_scraps FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "scraps_delete_own" ON public.inventory_scraps FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- 3) stock_movements.lot_id
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS lot_id uuid REFERENCES public.inventory_lots(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS stock_movements_lot_idx ON public.stock_movements(lot_id);

-- 4) Trigger FEFO: ao registrar saída sem lot_id, consumir do lote com validade mais próxima.
--    Ao registrar entrada com lot_id, adicionar à quantidade do lote.
CREATE OR REPLACE FUNCTION public.stock_movements_apply_lot_fefo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lot RECORD;
  v_remaining numeric;
  v_take numeric;
BEGIN
  IF NEW.type = 'entrada' AND NEW.lot_id IS NOT NULL THEN
    UPDATE public.inventory_lots
       SET quantity = COALESCE(quantity,0) + NEW.quantity,
           updated_at = now()
     WHERE id = NEW.lot_id AND owner_id = NEW.owner_id;
    RETURN NEW;
  END IF;

  IF NEW.type = 'saida' THEN
    IF NEW.lot_id IS NOT NULL THEN
      UPDATE public.inventory_lots
         SET quantity = GREATEST(0, COALESCE(quantity,0) - NEW.quantity),
             status = CASE WHEN COALESCE(quantity,0) - NEW.quantity <= 0 THEN 'esgotado' ELSE status END,
             updated_at = now()
       WHERE id = NEW.lot_id AND owner_id = NEW.owner_id;
      RETURN NEW;
    END IF;

    -- FEFO: consumir do(s) lote(s) ativo(s) com validade mais próxima
    v_remaining := NEW.quantity;
    FOR v_lot IN
      SELECT id, quantity FROM public.inventory_lots
       WHERE inventory_item_id = NEW.inventory_item_id
         AND owner_id = NEW.owner_id
         AND status = 'ativo'
         AND COALESCE(quantity,0) > 0
       ORDER BY expires_at NULLS LAST, received_at ASC
       FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := LEAST(v_remaining, v_lot.quantity);
      UPDATE public.inventory_lots
         SET quantity = v_lot.quantity - v_take,
             status = CASE WHEN v_lot.quantity - v_take <= 0 THEN 'esgotado' ELSE 'ativo' END,
             updated_at = now()
       WHERE id = v_lot.id;
      v_remaining := v_remaining - v_take;
      -- amarra o primeiro lote consumido ao movimento (rastreabilidade)
      IF NEW.lot_id IS NULL THEN
        NEW.lot_id := v_lot.id;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_movements_fefo ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_fefo
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.stock_movements_apply_lot_fefo();
