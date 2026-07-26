
-- 1. Header table
CREATE TABLE public.purchase_order_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  invoice_number text,
  received_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_por_po ON public.purchase_order_receipts(purchase_order_id);
CREATE INDEX idx_por_owner ON public.purchase_order_receipts(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_receipts TO authenticated;
GRANT ALL ON public.purchase_order_receipts TO service_role;
ALTER TABLE public.purchase_order_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "por select own" ON public.purchase_order_receipts FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "por insert own" ON public.purchase_order_receipts FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "por update own" ON public.purchase_order_receipts FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "por delete own" ON public.purchase_order_receipts FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER trg_por_updated BEFORE UPDATE ON public.purchase_order_receipts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Item table
CREATE TABLE public.purchase_order_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL REFERENCES public.purchase_order_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id uuid NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  qty_received numeric NOT NULL CHECK (qty_received > 0),
  supplier_lot text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pori_receipt ON public.purchase_order_receipt_items(receipt_id);
CREATE INDEX idx_pori_poi ON public.purchase_order_receipt_items(purchase_order_item_id);
CREATE INDEX idx_pori_owner ON public.purchase_order_receipt_items(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_receipt_items TO authenticated;
GRANT ALL ON public.purchase_order_receipt_items TO service_role;
ALTER TABLE public.purchase_order_receipt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pori select own" ON public.purchase_order_receipt_items FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "pori insert own" ON public.purchase_order_receipt_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pori update own" ON public.purchase_order_receipt_items FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pori delete own" ON public.purchase_order_receipt_items FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- 3. On receipt item insert → stock entry + maybe close PO
CREATE OR REPLACE FUNCTION public.purchase_receipt_apply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_po_id uuid;
  v_po_code text;
  v_inv_id uuid;
  v_all_filled boolean;
BEGIN
  SELECT poi.purchase_order_id, po.code, poi.inventory_item_id
    INTO v_po_id, v_po_code, v_inv_id
    FROM public.purchase_order_items poi
    JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
   WHERE poi.id = NEW.purchase_order_item_id;

  IF v_inv_id IS NOT NULL THEN
    INSERT INTO public.stock_movements(
      owner_id, inventory_item_id, type, quantity,
      reference_kind, reference_id, supplier_lot, notes
    ) VALUES (
      NEW.owner_id, v_inv_id, 'entrada', NEW.qty_received,
      'purchase_order_receipt', NEW.receipt_id, NEW.supplier_lot,
      'Recebimento parcial OC ' || v_po_code
    );
  END IF;

  -- Check if PO is fully received across all items
  SELECT bool_and(COALESCE(recv.total, 0) >= poi.quantity)
    INTO v_all_filled
    FROM public.purchase_order_items poi
    LEFT JOIN (
      SELECT pori.purchase_order_item_id, SUM(pori.qty_received) AS total
        FROM public.purchase_order_receipt_items pori
       GROUP BY pori.purchase_order_item_id
    ) recv ON recv.purchase_order_item_id = poi.id
   WHERE poi.purchase_order_id = v_po_id;

  IF v_all_filled THEN
    UPDATE public.purchase_orders
       SET status = 'recebido', updated_at = now()
     WHERE id = v_po_id AND status <> 'recebido';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_pori_apply
AFTER INSERT ON public.purchase_order_receipt_items
FOR EACH ROW EXECUTE FUNCTION public.purchase_receipt_apply();

-- 4. Prevent double entry: old trigger skips when receipts exist
CREATE OR REPLACE FUNCTION public.purchase_orders_to_stock_entries()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item RECORD;
BEGIN
  IF NEW.status <> 'recebido' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'recebido' THEN RETURN NEW; END IF;

  -- Skip if partial receipts already generated stock movements
  IF EXISTS (
    SELECT 1 FROM public.purchase_order_receipts
     WHERE purchase_order_id = NEW.id
  ) THEN RETURN NEW; END IF;

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
