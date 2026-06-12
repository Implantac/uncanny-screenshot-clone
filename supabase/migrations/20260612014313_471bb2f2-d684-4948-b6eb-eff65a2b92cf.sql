
CREATE TYPE public.collection_status AS ENUM ('briefing', 'design', 'desenvolvimento', 'producao', 'entregue');

CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  season TEXT NOT NULL,
  year INTEGER NOT NULL,
  status public.collection_status NOT NULL DEFAULT 'briefing',
  description TEXT,
  palette TEXT[] DEFAULT '{}',
  launch_date DATE,
  cover_url TEXT,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collections TO authenticated;
GRANT ALL ON public.collections TO service_role;

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view collections"
  ON public.collections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create collections"
  ON public.collections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their collections"
  ON public.collections FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their collections"
  ON public.collections FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_collections_owner ON public.collections(owner_id);
CREATE INDEX idx_collections_status ON public.collections(status);
