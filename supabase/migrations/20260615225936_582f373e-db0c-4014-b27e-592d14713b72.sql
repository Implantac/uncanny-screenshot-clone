
-- product_color_options
CREATE TABLE public.product_color_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  hex text,
  position int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_color_options TO authenticated;
GRANT ALL ON public.product_color_options TO service_role;
ALTER TABLE public.product_color_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own colors" ON public.product_color_options FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER product_color_options_updated_at BEFORE UPDATE ON public.product_color_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- product_size_options
CREATE TABLE public.product_size_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL,
  position int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_size_options TO authenticated;
GRANT ALL ON public.product_size_options TO service_role;
ALTER TABLE public.product_size_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sizes" ON public.product_size_options FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER product_size_options_updated_at BEFORE UPDATE ON public.product_size_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- product_variants
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color_id uuid REFERENCES public.product_color_options(id) ON DELETE SET NULL,
  size_id uuid REFERENCES public.product_size_options(id) ON DELETE SET NULL,
  sku text NOT NULL,
  ean text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, sku),
  UNIQUE (product_id, color_id, size_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own variants" ON public.product_variants FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER product_variants_updated_at BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- production_order_grid
CREATE TABLE public.production_order_grid (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  production_order_id uuid NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (production_order_id, variant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_order_grid TO authenticated;
GRANT ALL ON public.production_order_grid TO service_role;
ALTER TABLE public.production_order_grid ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own op grid" ON public.production_order_grid FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER production_order_grid_updated_at BEFORE UPDATE ON public.production_order_grid
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- service_order_grid
CREATE TABLE public.service_order_grid (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  service_order_id uuid NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  qty_received numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_order_id, variant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_order_grid TO authenticated;
GRANT ALL ON public.service_order_grid TO service_role;
ALTER TABLE public.service_order_grid ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own os grid" ON public.service_order_grid FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER service_order_grid_updated_at BEFORE UPDATE ON public.service_order_grid
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
