-- 1) supplier_portal_tokens: revogar leitura da coluna token_hash de roles públicos
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM authenticated;
REVOKE SELECT (token_hash) ON public.supplier_portal_tokens FROM anon;

-- 2) supplier_portal_acks: adicionar políticas de escrita escopadas ao tenant.
--    Suppliers escrevem via API pública usando service_role (que bypassa RLS).
CREATE POLICY "Owners insert acks"
  ON public.supplier_portal_acks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update acks"
  ON public.supplier_portal_acks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners delete acks"
  ON public.supplier_portal_acks
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- 3) supplier_portal_attachments: adicionar INSERT/UPDATE escopados ao tenant.
--    Uploads de fornecedor seguem indo via API pública com service_role.
CREATE POLICY "Owners insert attachments"
  ON public.supplier_portal_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update attachments"
  ON public.supplier_portal_attachments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
