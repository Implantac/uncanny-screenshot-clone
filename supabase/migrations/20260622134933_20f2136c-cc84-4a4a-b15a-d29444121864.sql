
-- 1) production_order_comments: scope to tenant owner on all CRUD
DROP POLICY IF EXISTS "po comments read author or owner" ON public.production_order_comments;
DROP POLICY IF EXISTS "author or owner update po comments" ON public.production_order_comments;
DROP POLICY IF EXISTS "author or owner delete po comments" ON public.production_order_comments;

CREATE POLICY "tenant owner reads po comments"
  ON public.production_order_comments FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "tenant owner updates po comments"
  ON public.production_order_comments FOR UPDATE
  USING (owner_id = auth.uid() AND author_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND author_id = auth.uid());

CREATE POLICY "tenant owner deletes po comments"
  ON public.production_order_comments FOR DELETE
  USING (owner_id = auth.uid());

-- 2) supplier_portal_tokens: prevent token_hash from being read by clients (defense in depth).
-- Hash is only needed server-side via service_role for portal authentication.
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated, anon;
