-- ============================================================
-- Sprint 2 — Assortment Plan
-- ============================================================

-- 1) Canais de venda
DO $$ BEGIN
  CREATE TYPE public.sales_channel AS ENUM (
    'ecommerce', 'varejo_proprio', 'multimarcas', 'franquia', 'outlet'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) product_families — agrupamento merchandising por coleção
CREATE TABLE IF NOT EXISTS public.product_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_margin_pct numeric(5,2),
  price_tier text CHECK (price_tier IN ('entrada','medio','premium') OR price_tier IS NULL),
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_families TO authenticated;
GRANT ALL ON public.product_families TO service_role;

ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage product_families"
  ON public.product_families FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_product_families_updated_at
  BEFORE UPDATE ON public.product_families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_product_families_collection
  ON public.product_families(collection_id);

-- 3) collection_products.family_id — vínculo opcional produto↔família
ALTER TABLE public.collection_products
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.product_families(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_collection_products_family
  ON public.collection_products(family_id);

-- 4) assortment_plan — meta por coleção × canal × família
CREATE TABLE IF NOT EXISTS public.assortment_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  channel public.sales_channel NOT NULL,
  family_id uuid REFERENCES public.product_families(id) ON DELETE CASCADE,
  target_skus int NOT NULL DEFAULT 0 CHECK (target_skus >= 0),
  target_units int NOT NULL DEFAULT 0 CHECK (target_units >= 0),
  target_revenue numeric(14,2) NOT NULL DEFAULT 0 CHECK (target_revenue >= 0),
  target_margin_pct numeric(5,2),
  price_tier text CHECK (price_tier IN ('entrada','medio','premium') OR price_tier IS NULL),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, channel, family_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assortment_plan TO authenticated;
GRANT ALL ON public.assortment_plan TO service_role;

ALTER TABLE public.assortment_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage assortment_plan"
  ON public.assortment_plan FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_assortment_plan_updated_at
  BEFORE UPDATE ON public.assortment_plan
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_assortment_plan_collection
  ON public.assortment_plan(collection_id);
CREATE INDEX IF NOT EXISTS idx_assortment_plan_channel
  ON public.assortment_plan(collection_id, channel);
