CREATE TABLE public.influencers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  instagram TEXT,
  tiktok TEXT,
  youtube TEXT,
  cidade TEXT,
  estado TEXT,
  segmento TEXT,
  seguidores INTEGER NOT NULL DEFAULT 0,
  engajamento NUMERIC(5,2) NOT NULL DEFAULT 0,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendas_antes NUMERIC(10,2) NOT NULL DEFAULT 0,
  vendas_depois NUMERIC(10,2) NOT NULL DEFAULT 0,
  ticket_medio NUMERIC(12,2) NOT NULL DEFAULT 180,
  data_postagem DATE,
  foto_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencers TO authenticated;
GRANT ALL ON public.influencers TO service_role;

ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own influencers"
  ON public.influencers FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER update_influencers_updated_at
  BEFORE UPDATE ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_influencers_owner ON public.influencers(owner_id);