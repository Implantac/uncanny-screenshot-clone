-- Fix 1: sector_messages INSERT must also enforce owner_id = auth.uid()
DROP POLICY IF EXISTS "members post in their sector" ON public.sector_messages;
CREATE POLICY "members post in their sector"
  ON public.sector_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() = owner_id
    AND has_sector(auth.uid(), sector)
  );

-- Fix 2: hide token_hash from tenant SELECTs while preserving owner read of other columns
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated;
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM anon;