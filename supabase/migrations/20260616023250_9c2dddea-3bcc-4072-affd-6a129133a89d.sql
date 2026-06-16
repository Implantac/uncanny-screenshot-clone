
-- =========================================================
-- ONDA 14 — Sourcing, Target Costing, Library, Fit, Sustainability
-- =========================================================

-- 1. MATERIAL LIBRARY (reusable across collections)
CREATE TABLE public.material_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('tecido','aviamento','cor','estampa','etiqueta','outros')),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  composition text,
  color_hex text,
  unit text DEFAULT 'm',
  reference_cost numeric DEFAULT 0,
  preferred_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  image_url text,
  attributes jsonb DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_library TO authenticated;
GRANT ALL ON public.material_library TO service_role;
ALTER TABLE public.material_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages material_library" ON public.material_library
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_material_library_updated BEFORE UPDATE ON public.material_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. SOURCING / RFQ
CREATE TABLE public.rfq_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  material_id uuid REFERENCES public.material_library(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text DEFAULT 'm',
  needed_by date,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','cotando','decidida','cancelada')),
  notes text,
  awarded_quote_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_requests TO authenticated;
GRANT ALL ON public.rfq_requests TO service_role;
ALTER TABLE public.rfq_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages rfq_requests" ON public.rfq_requests
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_rfq_requests_updated BEFORE UPDATE ON public.rfq_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rfq_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  rfq_id uuid NOT NULL REFERENCES public.rfq_requests(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  unit_price numeric NOT NULL DEFAULT 0,
  lead_time_days integer DEFAULT 0,
  moq numeric DEFAULT 0,
  payment_terms text,
  notes text,
  awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_quotes TO authenticated;
GRANT ALL ON public.rfq_quotes TO service_role;
ALTER TABLE public.rfq_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages rfq_quotes" ON public.rfq_quotes
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_rfq_quotes_updated BEFORE UPDATE ON public.rfq_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. TARGET COSTING (per product)
CREATE TABLE public.product_target_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  target_cost numeric NOT NULL DEFAULT 0,
  target_margin_pct numeric NOT NULL DEFAULT 0,
  target_retail_price numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_target_costs TO authenticated;
GRANT ALL ON public.product_target_costs TO service_role;
ALTER TABLE public.product_target_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages product_target_costs" ON public.product_target_costs
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_product_target_costs_updated BEFORE UPDATE ON public.product_target_costs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. FIT SESSIONS
CREATE TABLE public.fit_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  prototype_id uuid REFERENCES public.prototypes(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  iteration integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','aprovada','reprovada','ajustes')),
  fit_model text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fit_sessions TO authenticated;
GRANT ALL ON public.fit_sessions TO service_role;
ALTER TABLE public.fit_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages fit_sessions" ON public.fit_sessions
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_fit_sessions_updated BEFORE UPDATE ON public.fit_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fit_session_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  fit_session_id uuid NOT NULL REFERENCES public.fit_sessions(id) ON DELETE CASCADE,
  pom_label text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','ajuste','critico')),
  comment text NOT NULL,
  image_url text,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fit_session_comments TO authenticated;
GRANT ALL ON public.fit_session_comments TO service_role;
ALTER TABLE public.fit_session_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages fit_session_comments" ON public.fit_session_comments
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 5. SUSTAINABILITY SCORING
CREATE TABLE public.product_sustainability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  co2_kg numeric DEFAULT 0,
  water_liters numeric DEFAULT 0,
  recycled_pct numeric DEFAULT 0,
  organic_pct numeric DEFAULT 0,
  certifications text[] DEFAULT '{}',
  higg_msi_score numeric DEFAULT 0,
  score_overall integer DEFAULT 0 CHECK (score_overall BETWEEN 0 AND 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_sustainability TO authenticated;
GRANT ALL ON public.product_sustainability TO service_role;
ALTER TABLE public.product_sustainability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages product_sustainability" ON public.product_sustainability
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_product_sustainability_updated BEFORE UPDATE ON public.product_sustainability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_material_library_owner_kind ON public.material_library(owner_id, kind);
CREATE INDEX idx_rfq_requests_owner_status ON public.rfq_requests(owner_id, status);
CREATE INDEX idx_rfq_quotes_rfq ON public.rfq_quotes(rfq_id);
CREATE INDEX idx_fit_sessions_prototype ON public.fit_sessions(prototype_id);
CREATE INDEX idx_fit_comments_session ON public.fit_session_comments(fit_session_id);
