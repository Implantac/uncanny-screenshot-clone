-- Revoke column-level SELECT on token_hash from tenant users; keep it for service_role only.
REVOKE SELECT ON public.supplier_portal_tokens FROM authenticated;
GRANT SELECT (id, owner_id, supplier_id, expires_at, last_used_at, created_at, updated_at)
  ON public.supplier_portal_tokens TO authenticated;
GRANT INSERT (owner_id, supplier_id, token_hash, expires_at) ON public.supplier_portal_tokens TO authenticated;
GRANT UPDATE (expires_at, last_used_at) ON public.supplier_portal_tokens TO authenticated;
GRANT DELETE ON public.supplier_portal_tokens TO authenticated;
GRANT ALL ON public.supplier_portal_tokens TO service_role;