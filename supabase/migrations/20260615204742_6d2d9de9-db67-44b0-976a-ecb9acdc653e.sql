
CREATE TABLE public.erp_sales_mirror (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  erp_sale_id text NOT NULL,
  sku text,
  product_ref text,
  quantity numeric NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  customer text,
  region text,
  channel text,
  sold_at timestamptz,
  influencer_code text,
  campaign_code text,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, erp_sale_id)
);
CREATE INDEX idx_erp_sales_owner_date ON public.erp_sales_mirror(owner_id, sold_at DESC);
CREATE INDEX idx_erp_sales_sku ON public.erp_sales_mirror(owner_id, sku);
CREATE INDEX idx_erp_sales_inf ON public.erp_sales_mirror(owner_id, influencer_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_sales_mirror TO authenticated;
GRANT ALL ON public.erp_sales_mirror TO service_role;
ALTER TABLE public.erp_sales_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_sales own" ON public.erp_sales_mirror FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER update_erp_sales_mirror_updated_at BEFORE UPDATE ON public.erp_sales_mirror FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.erp_inventory_mirror (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sku text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  location text,
  erp_updated_at timestamptz,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, sku, location)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_inventory_mirror TO authenticated;
GRANT ALL ON public.erp_inventory_mirror TO service_role;
ALTER TABLE public.erp_inventory_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_inv own" ON public.erp_inventory_mirror FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER update_erp_inv_mirror_updated_at BEFORE UPDATE ON public.erp_inventory_mirror FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.erp_purchase_mirror (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  erp_po_code text NOT NULL,
  supplier text,
  total_value numeric NOT NULL DEFAULT 0,
  status text,
  ordered_at timestamptz,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, erp_po_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_purchase_mirror TO authenticated;
GRANT ALL ON public.erp_purchase_mirror TO service_role;
ALTER TABLE public.erp_purchase_mirror ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erp_po own" ON public.erp_purchase_mirror FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER update_erp_po_mirror_updated_at BEFORE UPDATE ON public.erp_purchase_mirror FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
