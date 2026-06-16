CREATE TABLE public.production_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (production_order_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_packages TO authenticated;
GRANT ALL ON public.production_packages TO service_role;

ALTER TABLE public.production_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages packages" ON public.production_packages
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_production_packages_updated_at
  BEFORE UPDATE ON public.production_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.service_orders
  ADD COLUMN package_id UUID REFERENCES public.production_packages(id) ON DELETE SET NULL,
  ADD COLUMN variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE INDEX idx_service_orders_package ON public.service_orders(package_id) WHERE package_id IS NOT NULL;
CREATE INDEX idx_service_orders_variant ON public.service_orders(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_service_orders_supplier_status ON public.service_orders(supplier_id, status) WHERE supplier_id IS NOT NULL;

CREATE OR REPLACE VIEW public.v_supplier_wip
WITH (security_invoker = on) AS
SELECT
  so.owner_id,
  so.supplier_id,
  COUNT(DISTINCT so.id)                                    AS open_os_count,
  COUNT(DISTINCT so.production_order_id)                   AS open_lot_count,
  COUNT(DISTINCT so.variant_id) FILTER (WHERE so.variant_id IS NOT NULL) AS distinct_refs,
  COALESCE(SUM(so.quantity - COALESCE(so.qty_received, 0)), 0)::int AS pieces_at_supplier,
  MIN(so.sent_at)                                          AS oldest_sent_at,
  MAX(EXTRACT(EPOCH FROM (now() - so.sent_at))/86400)::int AS max_days_at_supplier
FROM public.service_orders so
WHERE so.supplier_id IS NOT NULL
  AND so.status IN ('enviada','em_andamento')
GROUP BY so.owner_id, so.supplier_id;

GRANT SELECT ON public.v_supplier_wip TO authenticated;