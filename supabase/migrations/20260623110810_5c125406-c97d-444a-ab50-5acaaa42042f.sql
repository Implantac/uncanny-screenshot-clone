
-- Fix sector_messages cross-tenant read
DROP POLICY IF EXISTS "members read sector messages" ON public.sector_messages;
CREATE POLICY "members read sector messages" ON public.sector_messages
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND has_sector(auth.uid(), sector));

-- Fix prototype_comments cross-tenant insert
DROP POLICY IF EXISTS "prototype_comments_insert_team" ON public.prototype_comments;
CREATE POLICY "prototype_comments_insert_team" ON public.prototype_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.prototypes p
      WHERE p.id = prototype_comments.prototype_id
        AND p.owner_id = auth.uid()
    )
  );

-- Revoke column-level read of token_hash from authenticated/anon
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated;
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM anon;
