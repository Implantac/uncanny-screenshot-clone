
-- enum status do pedido de compra
DO $$ BEGIN
  CREATE TYPE public.purchase_order_status AS ENUM ('rascunho','cotando','aprovado','recebido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) purchase_orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  code text NOT NULL,
  status public.purchase_order_status NOT NULL DEFAULT 'rascunho',
  expected_date date,
  total_value numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po select own" ON public.purchase_orders FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "po insert own" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "po update own" ON public.purchase_orders FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "po delete own" ON public.purchase_orders FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_owner_status ON public.purchase_orders(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON public.purchase_orders(supplier_id) WHERE supplier_id IS NOT NULL;

CREATE TRIGGER trg_purchase_orders_updated
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) purchase_order_items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poi select own" ON public.purchase_order_items FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "poi insert own" ON public.purchase_order_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "poi update own" ON public.purchase_order_items FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "poi delete own" ON public.purchase_order_items FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_poi_order ON public.purchase_order_items(purchase_order_id);

-- 3) trigger: aprovado -> conta a pagar (idempotente)
CREATE OR REPLACE FUNCTION public.purchase_orders_to_financial_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  marker text;
  supplier_name text;
BEGIN
  IF NEW.status <> 'aprovado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' THEN RETURN NEW; END IF;

  marker := '[po:' || NEW.id::text || ']';

  IF EXISTS (
    SELECT 1 FROM public.financial_accounts
     WHERE owner_id = NEW.owner_id AND notes LIKE '%' || marker || '%'
  ) THEN RETURN NEW; END IF;

  SELECT name INTO supplier_name FROM public.suppliers WHERE id = NEW.supplier_id;

  INSERT INTO public.financial_accounts(owner_id, type, description, due_date, value, status, notes)
  VALUES (
    NEW.owner_id, 'pagar',
    'Pedido de compra ' || NEW.code || COALESCE(' - ' || supplier_name, ''),
    COALESCE(NEW.expected_date, CURRENT_DATE + INTERVAL '30 days'),
    NEW.total_value, 'pendente',
    'Gerada automaticamente do pedido de compra ' || NEW.code || ' ' || marker
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_orders_to_financial_account() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_po_to_financial ON public.purchase_orders;
CREATE TRIGGER trg_po_to_financial
AFTER INSERT OR UPDATE OF status ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.purchase_orders_to_financial_account();

-- 4) trigger: recebido -> entradas de estoque (idempotente via stock_movements.reference)
CREATE OR REPLACE FUNCTION public.purchase_orders_to_stock_entries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status <> 'recebido' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'recebido' THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.stock_movements
     WHERE owner_id = NEW.owner_id
       AND reference_kind = 'purchase_order'
       AND reference_id = NEW.id
  ) THEN RETURN NEW; END IF;

  FOR item IN
    SELECT * FROM public.purchase_order_items
     WHERE purchase_order_id = NEW.id AND inventory_item_id IS NOT NULL
  LOOP
    INSERT INTO public.stock_movements(
      owner_id, inventory_item_id, type, quantity,
      reference_kind, reference_id, notes
    ) VALUES (
      NEW.owner_id, item.inventory_item_id, 'entrada', item.quantity,
      'purchase_order', NEW.id,
      'Entrada por recebimento do PO ' || NEW.code
    );
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_orders_to_stock_entries() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_po_to_stock ON public.purchase_orders;
CREATE TRIGGER trg_po_to_stock
AFTER INSERT OR UPDATE OF status ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.purchase_orders_to_stock_entries();
