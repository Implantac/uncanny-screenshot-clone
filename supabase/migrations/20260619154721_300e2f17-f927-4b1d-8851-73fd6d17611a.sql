
CREATE TABLE public.marketing_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL,
  title text NOT NULL,
  objective text NOT NULL,
  target_audience text,
  key_message text,
  tone text,
  channels text[] DEFAULT '{}',
  budget numeric DEFAULT 0,
  kpi_target text,
  lifecycle_trigger text,
  status text NOT NULL DEFAULT 'rascunho',
  ai_plan jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_briefs TO authenticated;
GRANT ALL ON public.marketing_briefs TO service_role;

ALTER TABLE public.marketing_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage marketing_briefs"
  ON public.marketing_briefs FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_marketing_briefs_updated
  BEFORE UPDATE ON public.marketing_briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_marketing_briefs_owner ON public.marketing_briefs(owner_id);
CREATE INDEX idx_marketing_briefs_collection ON public.marketing_briefs(collection_id);
CREATE INDEX idx_marketing_briefs_campaign ON public.marketing_briefs(campaign_id);
