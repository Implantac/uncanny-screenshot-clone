CREATE POLICY "owner reads supplier portal tokens"
ON public.supplier_portal_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);