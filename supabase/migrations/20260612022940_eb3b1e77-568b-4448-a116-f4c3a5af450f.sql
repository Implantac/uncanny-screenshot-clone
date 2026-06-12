
CREATE TYPE public.inventory_category AS ENUM ('tecido','aviamento','acabado','outros');
CREATE TYPE public.account_type AS ENUM ('pagar','receber');
CREATE TYPE public.account_status AS ENUM ('pendente','pago','atrasado','cancelado');
CREATE TYPE public.campaign_status AS ENUM ('programada','ativa','pausada','concluida');

CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  sku text NOT NULL,
  name text NOT NULL,
  category public.inventory_category NOT NULL DEFAULT 'outros',
  deposit text,
  unit text NOT NULL DEFAULT 'un',
  balance numeric NOT NULL DEFAULT 0,
  minimum numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view inventory" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own inventory" ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "update own inventory" ON public.inventory_items FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "delete own inventory" ON public.inventory_items FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  type public.account_type NOT NULL,
  description text NOT NULL,
  due_date date NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  status public.account_status NOT NULL DEFAULT 'pendente',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view accounts" ON public.financial_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own accounts" ON public.financial_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "update own accounts" ON public.financial_accounts FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "delete own accounts" ON public.financial_accounts FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER update_financial_accounts_updated_at BEFORE UPDATE ON public.financial_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  channel text,
  start_date date,
  end_date date,
  investment numeric NOT NULL DEFAULT 0,
  roas numeric NOT NULL DEFAULT 0,
  status public.campaign_status NOT NULL DEFAULT 'programada',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view campaigns" ON public.marketing_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own campaigns" ON public.marketing_campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "update own campaigns" ON public.marketing_campaigns FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "delete own campaigns" ON public.marketing_campaigns FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER update_marketing_campaigns_updated_at BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
