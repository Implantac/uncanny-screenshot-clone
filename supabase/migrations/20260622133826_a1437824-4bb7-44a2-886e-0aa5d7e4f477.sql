ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS erp_source text,
  ADD COLUMN IF NOT EXISTS erp_id text,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS products_erp_link_unique
  ON public.products(owner_id, erp_source, erp_id)
  WHERE erp_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_erp_synced_at_idx
  ON public.products(erp_synced_at DESC NULLS LAST)
  WHERE erp_id IS NOT NULL;

COMMENT ON COLUMN public.products.erp_source IS 'Sistema de origem (ex: usesoft). Null = criado manualmente no PLM.';
COMMENT ON COLUMN public.products.erp_id IS 'ID original no ERP (nnumeroprodu). Null = não sincronizado.';
COMMENT ON COLUMN public.products.erp_synced_at IS 'Último sync bem-sucedido vindo do ERP.';