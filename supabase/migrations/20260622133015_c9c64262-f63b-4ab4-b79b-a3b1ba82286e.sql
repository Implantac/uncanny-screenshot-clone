ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS erp_source text,
  ADD COLUMN IF NOT EXISTS erp_id text,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS collections_owner_erp_uidx
  ON public.collections(owner_id, erp_source, erp_id)
  WHERE erp_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS collections_erp_synced_at_idx
  ON public.collections(erp_synced_at DESC NULLS LAST)
  WHERE erp_id IS NOT NULL;

COMMENT ON COLUMN public.collections.erp_source IS 'Sistema de origem (ex: usesoft). Null = criada manualmente no PLM.';
COMMENT ON COLUMN public.collections.erp_id IS 'ID original no ERP. Null = não sincronizada.';
COMMENT ON COLUMN public.collections.erp_synced_at IS 'Último sync bem-sucedido vindo do ERP.';