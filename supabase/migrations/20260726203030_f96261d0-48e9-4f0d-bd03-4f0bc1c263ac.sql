
-- Production orders: main listing sort (priority, due_date NULLS LAST) filtered by RLS owner_id
CREATE INDEX IF NOT EXISTS idx_po_owner_priority_due
  ON public.production_orders (owner_id, priority ASC, due_date ASC NULLS LAST);

-- Production orders: alerts by due date/status
CREATE INDEX IF NOT EXISTS idx_po_owner_status_due
  ON public.production_orders (owner_id, status, due_date);

-- Production orders: stage aging queries
CREATE INDEX IF NOT EXISTS idx_po_owner_status_stage_updated
  ON public.production_orders (owner_id, status, stage, stage_updated_at);

-- Production orders: FK helpers
CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON public.production_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_product_id  ON public.production_orders (product_id);

-- Products: default listing (owner scoped, newest first)
CREATE INDEX IF NOT EXISTS idx_products_owner_created
  ON public.products (owner_id, created_at DESC);

-- ERP sales mirror: reporting slices
CREATE INDEX IF NOT EXISTS idx_esm_owner_sold_at
  ON public.erp_sales_mirror (owner_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_esm_owner_campaign
  ON public.erp_sales_mirror (owner_id, campaign_code)
  WHERE campaign_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_esm_owner_sku
  ON public.erp_sales_mirror (owner_id, sku);

ANALYZE public.production_orders;
ANALYZE public.products;
ANALYZE public.erp_sales_mirror;
