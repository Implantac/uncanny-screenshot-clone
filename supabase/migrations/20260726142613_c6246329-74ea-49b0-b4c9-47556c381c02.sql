
ALTER TABLE public.production_orders
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS produced_qty numeric,
  ADD COLUMN IF NOT EXISTS rejected_qty numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS close_notes text;

CREATE INDEX IF NOT EXISTS idx_production_orders_closed_at
  ON public.production_orders(closed_at)
  WHERE closed_at IS NOT NULL;
