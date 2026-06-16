
CREATE TABLE public.influencer_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.collections(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pendente',
  shipped_at date,
  delivered_at date,
  posted_at date,
  post_url text,
  region text,
  sales_before numeric NOT NULL DEFAULT 0,
  sales_after numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencer_shipments TO authenticated;
GRANT ALL ON public.influencer_shipments TO service_role;

ALTER TABLE public.influencer_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own shipments"
ON public.influencer_shipments FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_influencer_shipments_updated_at
BEFORE UPDATE ON public.influencer_shipments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_influencer_shipments_owner ON public.influencer_shipments(owner_id);
CREATE INDEX idx_influencer_shipments_collection ON public.influencer_shipments(collection_id);
CREATE INDEX idx_influencer_shipments_influencer ON public.influencer_shipments(influencer_id);
