DROP TRIGGER IF EXISTS trg_b2b_to_financial ON public.b2b_orders;
DROP TRIGGER IF EXISTS trg_po_to_financial ON public.purchase_orders;
DROP TRIGGER IF EXISTS trg_po_to_stock ON public.purchase_orders;