-- Onda 28: Almoxarifado por cor/lote do fornecedor
-- Adiciona rastreamento de lote do fornecedor em movimentações e item-mestre.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS supplier_lot text;

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS supplier_lot text,
  ADD COLUMN IF NOT EXISTS supplier_color text;

CREATE INDEX IF NOT EXISTS idx_stock_movements_item_lot
  ON public.stock_movements(inventory_item_id, supplier_lot)
  WHERE supplier_lot IS NOT NULL;
