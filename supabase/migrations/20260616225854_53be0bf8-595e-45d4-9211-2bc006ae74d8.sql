ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS maximum numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_entry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_exit_at timestamptz,
  ADD COLUMN IF NOT EXISTS turnover_30d numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.inventory_items_update_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_turnover numeric;
BEGIN
  SELECT COALESCE(SUM(quantity), 0) INTO v_turnover
    FROM public.stock_movements
   WHERE inventory_item_id = NEW.inventory_item_id
     AND type = 'saida'
     AND created_at >= now() - INTERVAL '30 days';

  IF NEW.type = 'entrada' THEN
    UPDATE public.inventory_items
       SET last_entry_at = NEW.created_at,
           turnover_30d = v_turnover,
           updated_at = now()
     WHERE id = NEW.inventory_item_id;
  ELSIF NEW.type = 'saida' THEN
    UPDATE public.inventory_items
       SET last_exit_at = NEW.created_at,
           turnover_30d = v_turnover,
           updated_at = now()
     WHERE id = NEW.inventory_item_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_movements_update_inventory_metrics ON public.stock_movements;
CREATE TRIGGER stock_movements_update_inventory_metrics
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.inventory_items_update_metrics();