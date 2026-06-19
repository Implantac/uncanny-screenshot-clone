
-- Sprint 1: Carry-over + NOS foundation (N:N produto x coleção + lifecycle por coleção)

-- ENUMs
CREATE TYPE public.collection_product_role AS ENUM ('hero','carry_over','nos','capsule','regular');
CREATE TYPE public.product_lifecycle_state AS ENUM ('planned','active','markdown','discontinued','nos_permanent');

-- ============ collection_products (N:N) ============
CREATE TABLE public.collection_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  role public.collection_product_role NOT NULL DEFAULT 'regular',
  source_collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  intro_season text,
  channel_exclusive text[],
  display_order integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(collection_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_products TO authenticated;
GRANT ALL ON public.collection_products TO service_role;

ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage their collection_products"
  ON public.collection_products FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_collection_products_collection ON public.collection_products(collection_id);
CREATE INDEX idx_collection_products_product ON public.collection_products(product_id);
CREATE INDEX idx_collection_products_owner ON public.collection_products(owner_id);

CREATE TRIGGER trg_collection_products_updated_at
  BEFORE UPDATE ON public.collection_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ product_lifecycle ============
CREATE TABLE public.product_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  state public.product_lifecycle_state NOT NULL DEFAULT 'planned',
  replenishment_policy jsonb,
  markdown_pct numeric,
  state_changed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, collection_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_lifecycle TO authenticated;
GRANT ALL ON public.product_lifecycle TO service_role;

ALTER TABLE public.product_lifecycle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage their product_lifecycle"
  ON public.product_lifecycle FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_product_lifecycle_product ON public.product_lifecycle(product_id);
CREATE INDEX idx_product_lifecycle_collection ON public.product_lifecycle(collection_id);
CREATE INDEX idx_product_lifecycle_owner ON public.product_lifecycle(owner_id);

CREATE TRIGGER trg_product_lifecycle_updated_at
  BEFORE UPDATE ON public.product_lifecycle
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-stamp state_changed_at on state change
CREATE OR REPLACE FUNCTION public.product_lifecycle_stamp_state_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    NEW.state_changed_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_product_lifecycle_state_change
  BEFORE UPDATE ON public.product_lifecycle
  FOR EACH ROW EXECUTE FUNCTION public.product_lifecycle_stamp_state_change();

-- ============ Backfill ============
-- Cada produto já vinculado a uma coleção vira uma linha em collection_products com role='regular'
INSERT INTO public.collection_products (owner_id, collection_id, product_id, role)
SELECT p.owner_id, p.collection_id, p.id, 'regular'
  FROM public.products p
 WHERE p.collection_id IS NOT NULL
ON CONFLICT (collection_id, product_id) DO NOTHING;

-- E uma linha em product_lifecycle como 'active' (já estavam vinculados)
INSERT INTO public.product_lifecycle (owner_id, product_id, collection_id, state)
SELECT p.owner_id, p.id, p.collection_id, 'active'
  FROM public.products p
 WHERE p.collection_id IS NOT NULL
ON CONFLICT (product_id, collection_id) DO NOTHING;
