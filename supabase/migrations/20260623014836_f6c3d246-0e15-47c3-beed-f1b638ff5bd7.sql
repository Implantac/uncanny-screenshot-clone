ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS min_order_value numeric,
  ADD COLUMN IF NOT EXISTS min_order_qty integer;