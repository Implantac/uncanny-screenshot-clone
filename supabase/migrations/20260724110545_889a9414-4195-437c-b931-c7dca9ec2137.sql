
ALTER TABLE public.product_timeline_comments
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS product_timeline_comments_mentioned_user_ids_gin
  ON public.product_timeline_comments USING GIN (mentioned_user_ids);

-- Mentioned users can read the comment (in addition to existing owner-based policies)
DROP POLICY IF EXISTS "Mentioned users can read comment" ON public.product_timeline_comments;
CREATE POLICY "Mentioned users can read comment"
  ON public.product_timeline_comments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = ANY (mentioned_user_ids));
