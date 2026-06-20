ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS safety_days integer NOT NULL DEFAULT 7;

CREATE INDEX IF NOT EXISTS idx_inventory_items_preferred_supplier
  ON public.inventory_items(preferred_supplier_id)
  WHERE preferred_supplier_id IS NOT NULL;

COMMENT ON COLUMN public.inventory_items.preferred_supplier_id IS
  'Fornecedor preferencial — usado para derivar lead-time real no cálculo do ponto de reposição.';
COMMENT ON COLUMN public.inventory_items.safety_days IS
  'Dias de estoque de segurança usados no cálculo do ponto de reposição (padrão 7).';