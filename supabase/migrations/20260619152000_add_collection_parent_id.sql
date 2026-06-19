ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_collections_parent
  ON public.collections(parent_id)
  WHERE parent_id IS NOT NULL;
