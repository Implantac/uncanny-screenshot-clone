
-- 1) product_id em inventory_items
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_product_id
  ON public.inventory_items(product_id) WHERE product_id IS NOT NULL;

-- 2) enum tipo de movimentação
DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM ('entrada','saida','ajuste','transferencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) tabela stock_movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  type public.stock_movement_type NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  reference_kind text,
  reference_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own stock_movements"
  ON public.stock_movements FOR SELECT
  USING (auth.uid() = owner_id);
CREATE POLICY "insert own stock_movements"
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "delete own stock_movements"
  ON public.stock_movements FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_owner_created
  ON public.stock_movements(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item
  ON public.stock_movements(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref
  ON public.stock_movements(reference_kind, reference_id) WHERE reference_id IS NOT NULL;

-- 4) trigger: aplicar movimentação no saldo
CREATE OR REPLACE FUNCTION public.stock_movements_apply_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  delta numeric;
  current_balance numeric;
BEGIN
  IF NEW.type = 'entrada' THEN
    delta := NEW.quantity;
  ELSIF NEW.type = 'saida' THEN
    delta := -NEW.quantity;
  ELSIF NEW.type = 'ajuste' THEN
    -- ajuste: quantity é o novo saldo absoluto
    SELECT balance INTO current_balance
      FROM public.inventory_items WHERE id = NEW.inventory_item_id;
    delta := NEW.quantity - COALESCE(current_balance, 0);
  ELSE
    -- transferência: tratada como saida no item de origem
    delta := -NEW.quantity;
  END IF;

  IF delta < 0 THEN
    SELECT balance INTO current_balance
      FROM public.inventory_items
      WHERE id = NEW.inventory_item_id AND owner_id = NEW.owner_id
      FOR UPDATE;
    IF COALESCE(current_balance,0) + delta < 0 THEN
      RAISE EXCEPTION 'Saldo insuficiente para movimentação (item %, saldo % , delta %)',
        NEW.inventory_item_id, current_balance, delta;
    END IF;
  END IF;

  UPDATE public.inventory_items
     SET balance = COALESCE(balance,0) + delta,
         updated_at = now()
   WHERE id = NEW.inventory_item_id
     AND owner_id = NEW.owner_id;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.stock_movements_apply_balance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_stock_movements_apply ON public.stock_movements;
CREATE TRIGGER trg_stock_movements_apply
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.stock_movements_apply_balance();
