
ALTER TABLE public.product_timeline_comments
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_product_timeline_comments_resolved
  ON public.product_timeline_comments (product_id, resolved_at)
  WHERE parent_id IS NULL;
