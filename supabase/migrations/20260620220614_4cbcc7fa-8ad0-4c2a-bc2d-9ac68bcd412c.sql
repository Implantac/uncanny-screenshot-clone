ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS parent_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_production_orders_parent ON public.production_orders(parent_order_id);