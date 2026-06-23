
-- Reafirma políticas tenant-safe e revoga leitura do token_hash

-- sector_messages SELECT
DROP POLICY IF EXISTS "members read sector messages" ON public.sector_messages;
CREATE POLICY "members read sector messages"
  ON public.sector_messages
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() AND has_sector(auth.uid(), sector));

-- prototype_comments INSERT
DROP POLICY IF EXISTS "prototype_comments_insert_team" ON public.prototype_comments;
CREATE POLICY "prototype_comments_insert_team"
  ON public.prototype_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.prototypes p
      WHERE p.id = prototype_comments.prototype_id
        AND p.owner_id = auth.uid()
    )
  );

-- supplier_portal_tokens: revoga leitura do hash em nível de coluna
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated, anon;
