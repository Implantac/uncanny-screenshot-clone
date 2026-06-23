DROP POLICY IF EXISTS "team members insert po comments" ON public.production_order_comments;

REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated, anon;