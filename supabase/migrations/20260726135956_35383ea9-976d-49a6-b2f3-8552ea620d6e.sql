
CREATE TABLE public.collection_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hex TEXT NOT NULL,
  pantone TEXT,
  cmyk TEXT,
  usage_notes TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_colors TO authenticated;
GRANT ALL ON public.collection_colors TO service_role;
ALTER TABLE public.collection_colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cc_select" ON public.collection_colors FOR SELECT TO authenticated USING (true);
CREATE POLICY "cc_insert" ON public.collection_colors FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "cc_update" ON public.collection_colors FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "cc_delete" ON public.collection_colors FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER update_collection_colors_updated_at BEFORE UPDATE ON public.collection_colors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_collection_colors_collection ON public.collection_colors(collection_id);

CREATE TYPE public.print_technique AS ENUM ('silk','estampa_digital','sublimacao','dtf','bordado','transfer');
CREATE TYPE public.print_artwork_status AS ENUM ('rascunho','aguardando_prova','em_prova','aprovada','rejeitada','liberada_producao');

CREATE TABLE public.print_artworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  collection_id UUID REFERENCES public.collections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  technique public.print_technique NOT NULL DEFAULT 'silk',
  artwork_url TEXT,
  colors TEXT[] NOT NULL DEFAULT '{}',
  position_notes TEXT,
  size_notes TEXT,
  supplier_id UUID,
  status public.print_artwork_status NOT NULL DEFAULT 'rascunho',
  released_at TIMESTAMPTZ,
  released_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  released_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_artworks TO authenticated;
GRANT ALL ON public.print_artworks TO service_role;
ALTER TABLE public.print_artworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_select" ON public.print_artworks FOR SELECT TO authenticated USING (true);
CREATE POLICY "pa_insert" ON public.print_artworks FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pa_update" ON public.print_artworks FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pa_delete" ON public.print_artworks FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER update_print_artworks_updated_at BEFORE UPDATE ON public.print_artworks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_print_artworks_product ON public.print_artworks(product_id);
CREATE INDEX idx_print_artworks_collection ON public.print_artworks(collection_id);
CREATE INDEX idx_print_artworks_status ON public.print_artworks(status);

CREATE TYPE public.print_proof_status AS ENUM ('pendente','aprovada','ajuste','rejeitada');

CREATE TABLE public.print_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artwork_id UUID NOT NULL REFERENCES public.print_artworks(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round INTEGER NOT NULL DEFAULT 1,
  proof_url TEXT,
  notes TEXT,
  status public.print_proof_status NOT NULL DEFAULT 'pendente',
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_proofs TO authenticated;
GRANT ALL ON public.print_proofs TO service_role;
ALTER TABLE public.print_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp_select" ON public.print_proofs FOR SELECT TO authenticated USING (true);
CREATE POLICY "pp_insert" ON public.print_proofs FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pp_update" ON public.print_proofs FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pp_delete" ON public.print_proofs FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER update_print_proofs_updated_at BEFORE UPDATE ON public.print_proofs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_print_proofs_artwork ON public.print_proofs(artwork_id);
CREATE INDEX idx_print_proofs_status ON public.print_proofs(status);
