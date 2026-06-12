
-- Prototipos
CREATE TYPE public.prototype_stage AS ENUM ('solicitado','em_confeccao','em_prova','aprovado','reprovado');

CREATE TABLE public.prototypes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  code text NOT NULL,
  stage public.prototype_stage NOT NULL DEFAULT 'solicitado',
  due_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prototypes TO authenticated;
GRANT ALL ON public.prototypes TO service_role;
ALTER TABLE public.prototypes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read prototypes" ON public.prototypes FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner insert prototypes" ON public.prototypes FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update prototypes" ON public.prototypes FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner delete prototypes" ON public.prototypes FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER trg_prototypes_updated BEFORE UPDATE ON public.prototypes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tech sheets (Ficha Técnica)
CREATE TYPE public.tech_sheet_status AS ENUM ('rascunho','em_revisao','aprovada');

CREATE TABLE public.tech_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  code text NOT NULL,
  version text NOT NULL DEFAULT 'v1.0',
  status public.tech_sheet_status NOT NULL DEFAULT 'rascunho',
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheets TO authenticated;
GRANT ALL ON public.tech_sheets TO service_role;
ALTER TABLE public.tech_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read tech_sheets" ON public.tech_sheets FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner insert tech_sheets" ON public.tech_sheets FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update tech_sheets" ON public.tech_sheets FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner delete tech_sheets" ON public.tech_sheets FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER trg_tech_sheets_updated BEFORE UPDATE ON public.tech_sheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Production Orders (PCP)
CREATE TYPE public.production_status AS ENUM ('aguardando','em_producao','concluida','atrasada','cancelada');

CREATE TABLE public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  code text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  progress integer NOT NULL DEFAULT 0,
  due_date date,
  status public.production_status NOT NULL DEFAULT 'aguardando',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_orders TO authenticated;
GRANT ALL ON public.production_orders TO service_role;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read production_orders" ON public.production_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner insert production_orders" ON public.production_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update production_orders" ON public.production_orders FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner delete production_orders" ON public.production_orders FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER trg_production_orders_updated BEFORE UPDATE ON public.production_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- B2B Orders
CREATE TYPE public.b2b_order_status AS ENUM ('rascunho','aprovado','em_producao','faturado','cancelado');

CREATE TABLE public.b2b_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  customer_name text NOT NULL,
  representative text,
  total_value numeric(12,2) NOT NULL DEFAULT 0,
  status public.b2b_order_status NOT NULL DEFAULT 'rascunho',
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.b2b_orders TO authenticated;
GRANT ALL ON public.b2b_orders TO service_role;
ALTER TABLE public.b2b_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read b2b_orders" ON public.b2b_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner insert b2b_orders" ON public.b2b_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update b2b_orders" ON public.b2b_orders FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner delete b2b_orders" ON public.b2b_orders FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER trg_b2b_orders_updated BEFORE UPDATE ON public.b2b_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
