
-- 1) supplier_portal_tokens: revoke column-level SELECT on token_hash
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated;
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM anon;

-- 2) production_order_comments: enforce owner_id = auth.uid() on insert
DROP POLICY IF EXISTS "members insert their own comments" ON public.production_order_comments;
DROP POLICY IF EXISTS "users insert their own comments" ON public.production_order_comments;
DROP POLICY IF EXISTS "insert order comments" ON public.production_order_comments;
DROP POLICY IF EXISTS "Authors insert comments on accessible orders" ON public.production_order_comments;

CREATE POLICY "Authors insert comments on own tenant orders"
ON public.production_order_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_id = auth.uid()
  AND owner_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.production_orders po
    WHERE po.id = production_order_id
      AND po.owner_id = auth.uid()
  )
);

-- 3) mrp_recalc_queue: explicit owner-scoped INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "owner inserts mrp recalc queue" ON public.mrp_recalc_queue;
DROP POLICY IF EXISTS "owner updates mrp recalc queue" ON public.mrp_recalc_queue;
DROP POLICY IF EXISTS "owner deletes mrp recalc queue" ON public.mrp_recalc_queue;

CREATE POLICY "owner inserts mrp recalc queue"
ON public.mrp_recalc_queue
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner updates mrp recalc queue"
ON public.mrp_recalc_queue
FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner deletes mrp recalc queue"
ON public.mrp_recalc_queue
FOR DELETE TO authenticated
USING (owner_id = auth.uid());
