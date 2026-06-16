
CREATE TABLE public.dpp_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado','revogado')),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  hash text,
  composition text,
  origin text,
  care_instructions text,
  repairability_score int,
  certifications text[],
  published_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dpp_records_product_idx ON public.dpp_records(product_id);
CREATE INDEX dpp_records_status_idx ON public.dpp_records(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dpp_records TO authenticated;
GRANT SELECT ON public.dpp_records TO anon;
GRANT ALL ON public.dpp_records TO service_role;

ALTER TABLE public.dpp_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage dpp_records"
  ON public.dpp_records FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "public reads published dpp"
  ON public.dpp_records FOR SELECT TO anon, authenticated
  USING (status = 'publicado');

CREATE TRIGGER dpp_records_updated_at
  BEFORE UPDATE ON public.dpp_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dpp_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dpp_record_id uuid NOT NULL REFERENCES public.dpp_records(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ip_hash text,
  user_agent text,
  referrer text,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dpp_views_record_idx ON public.dpp_views(dpp_record_id);

GRANT SELECT ON public.dpp_views TO authenticated;
GRANT ALL ON public.dpp_views TO service_role;

ALTER TABLE public.dpp_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners read views of their dpp"
  ON public.dpp_views FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dpp_records r
     WHERE r.id = dpp_views.dpp_record_id AND r.owner_id = auth.uid()
  ));
