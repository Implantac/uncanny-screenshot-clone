
-- ========== customers ==========
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  document text,
  email text,
  phone text,
  city text,
  state text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers select own" ON public.customers FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "customers insert own" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "customers update own" ON public.customers FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "customers delete own" ON public.customers FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_owner ON public.customers(owner_id);
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== representatives ==========
CREATE TABLE IF NOT EXISTS public.representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  commission_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.representatives TO authenticated;
GRANT ALL ON public.representatives TO service_role;
ALTER TABLE public.representatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reps select own" ON public.representatives FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "reps insert own" ON public.representatives FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "reps update own" ON public.representatives FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "reps delete own" ON public.representatives FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX IF NOT EXISTS idx_reps_owner ON public.representatives(owner_id);
CREATE TRIGGER trg_reps_updated BEFORE UPDATE ON public.representatives
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== production_batches ==========
DO $$ BEGIN
  CREATE TYPE public.production_batch_status AS ENUM ('planejado','em_producao','finalizado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  status public.production_batch_status NOT NULL DEFAULT 'planejado',
  planned_qty integer NOT NULL DEFAULT 0,
  produced_qty integer NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_batches TO authenticated;
GRANT ALL ON public.production_batches TO service_role;
ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches select own" ON public.production_batches FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "batches insert own" ON public.production_batches FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "batches update own" ON public.production_batches FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "batches delete own" ON public.production_batches FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX IF NOT EXISTS idx_batches_owner_status ON public.production_batches(owner_id, status);
CREATE TRIGGER trg_batches_updated BEFORE UPDATE ON public.production_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== collection_versions ==========
CREATE TABLE IF NOT EXISTS public.collection_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  version text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.collection_versions TO authenticated;
GRANT ALL ON public.collection_versions TO service_role;
ALTER TABLE public.collection_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cv select own" ON public.collection_versions FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "cv insert own" ON public.collection_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "cv delete own" ON public.collection_versions FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX IF NOT EXISTS idx_cv_collection ON public.collection_versions(collection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_owner ON public.collection_versions(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cv_collection_version ON public.collection_versions(collection_id, version);

-- ========== b2b_orders: FK opcionais ==========
ALTER TABLE public.b2b_orders
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS representative_id uuid REFERENCES public.representatives(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_b2b_orders_customer ON public.b2b_orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_b2b_orders_rep ON public.b2b_orders(representative_id) WHERE representative_id IS NOT NULL;
