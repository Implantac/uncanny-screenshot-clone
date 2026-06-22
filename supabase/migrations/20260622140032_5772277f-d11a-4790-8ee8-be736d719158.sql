-- Customers: vínculo ERP
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS erp_source text,
  ADD COLUMN IF NOT EXISTS erp_id text,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS customers_erp_link_unique
  ON public.customers (owner_id, erp_source, erp_id)
  WHERE erp_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customers_erp_synced_at_idx
  ON public.customers (erp_synced_at DESC NULLS LAST)
  WHERE erp_id IS NOT NULL;

-- Suppliers: vínculo ERP + CNPJ/CPF (não tinha)
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS erp_source text,
  ADD COLUMN IF NOT EXISTS erp_id text,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_erp_link_unique
  ON public.suppliers (owner_id, erp_source, erp_id)
  WHERE erp_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS suppliers_erp_synced_at_idx
  ON public.suppliers (erp_synced_at DESC NULLS LAST)
  WHERE erp_id IS NOT NULL;