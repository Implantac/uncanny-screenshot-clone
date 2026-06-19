CREATE TABLE IF NOT EXISTS public.product_marketing_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  cost_type text NOT NULL DEFAULT 'outro' CHECK (
    cost_type IN ('ensaio', 'foto', 'video', 'trafego', 'influencer', 'producao', 'outro')
  ),
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  spent_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_marketing_costs_owner_date
  ON public.product_marketing_costs(owner_id, spent_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_marketing_costs_product
  ON public.product_marketing_costs(owner_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_marketing_costs_collection
  ON public.product_marketing_costs(owner_id, collection_id);
CREATE INDEX IF NOT EXISTS idx_product_marketing_costs_campaign
  ON public.product_marketing_costs(owner_id, campaign_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_marketing_costs TO authenticated;
GRANT ALL ON public.product_marketing_costs TO service_role;

ALTER TABLE public.product_marketing_costs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_marketing_costs own" ON public.product_marketing_costs;
CREATE POLICY "product_marketing_costs own"
  ON public.product_marketing_costs
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP TRIGGER IF EXISTS update_product_marketing_costs_updated_at ON public.product_marketing_costs;
CREATE TRIGGER update_product_marketing_costs_updated_at
  BEFORE UPDATE ON public.product_marketing_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
