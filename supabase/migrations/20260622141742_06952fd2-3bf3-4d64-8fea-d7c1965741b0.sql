
-- 1. Fix production_order_comments INSERT policy: allow team members (same tenant) to comment
DROP POLICY IF EXISTS "auth insert po comments as author" ON public.production_order_comments;

CREATE POLICY "team members insert po comments"
ON public.production_order_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_comments.production_order_id
      AND po.owner_id = production_order_comments.owner_id
  )
);

-- 2. Revoke column-level SELECT on token_hash from authenticated
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated;

-- 3. Lock down realtime.messages: only allow subscriptions to topics scoped to the user's tenant
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated users subscribe to own tenant topics" ON realtime.messages;

CREATE POLICY "authenticated users subscribe to own tenant topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  topic LIKE (auth.uid()::text || ':%')
  OR topic = auth.uid()::text
);
