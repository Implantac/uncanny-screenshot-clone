ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS line_type text NOT NULL DEFAULT 'primeira'
  CHECK (line_type IN ('primeira', 'segunda_linha'));

CREATE INDEX IF NOT EXISTS idx_service_orders_owner_line_type
  ON public.service_orders(owner_id, line_type)
  WHERE line_type = 'segunda_linha';