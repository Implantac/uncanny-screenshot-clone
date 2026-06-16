ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_orders_created_by_received_at_idx
  ON public.service_orders(created_by, received_at DESC)
  WHERE received_at IS NOT NULL;