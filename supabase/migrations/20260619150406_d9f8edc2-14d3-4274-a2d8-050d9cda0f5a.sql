-- ============================================================
-- Sprint 4 — Temas, Linhas, OTB, Drag-and-Drop
-- ============================================================

-- 1) collection_themes
CREATE TABLE IF NOT EXISTS public.collection_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text,
  palette text[],
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_themes TO authenticated;
GRANT ALL ON public.collection_themes TO service_role;

ALTER TABLE public.collection_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage collection_themes"
  ON public.collection_themes FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_collection_themes_updated_at
  BEFORE UPDATE ON public.collection_themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_collection_themes_collection
  ON public.collection_themes(collection_id);

ALTER TABLE public.collection_products
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.collection_themes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_collection_products_theme
  ON public.collection_products(theme_id);

-- 2) product_lines
CREATE TABLE IF NOT EXISTS public.product_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  season text,
  year int,
  description text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_lines TO authenticated;
GRANT ALL ON public.product_lines TO service_role;

ALTER TABLE public.product_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage product_lines"
  ON public.product_lines FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_product_lines_updated_at
  BEFORE UPDATE ON public.product_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS line_id uuid REFERENCES public.product_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_line ON public.products(line_id);

-- 3) Backfill: each distinct category per owner becomes a product_line, products get line_id
INSERT INTO public.product_lines (owner_id, name)
SELECT DISTINCT owner_id, trim(category)
  FROM public.products
 WHERE category IS NOT NULL AND trim(category) <> ''
ON CONFLICT (owner_id, name) DO NOTHING;

UPDATE public.products p
   SET line_id = pl.id
  FROM public.product_lines pl
 WHERE p.line_id IS NULL
   AND p.owner_id = pl.owner_id
   AND p.category IS NOT NULL
   AND trim(p.category) = pl.name;
