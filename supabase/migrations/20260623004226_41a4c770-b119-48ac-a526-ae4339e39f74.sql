ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS expires_at date;

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_expires
  ON public.stock_movements (inventory_item_id, expires_at)
  WHERE expires_at IS NOT NULL;