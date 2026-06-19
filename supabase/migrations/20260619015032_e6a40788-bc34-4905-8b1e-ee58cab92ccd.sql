CREATE OR REPLACE FUNCTION public.supplier_portal_tokens_protect_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.token IS DISTINCT FROM OLD.token
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
    RAISE EXCEPTION 'token, owner_id and supplier_id are immutable on supplier_portal_tokens';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_supplier_portal_tokens_immutable ON public.supplier_portal_tokens;
CREATE TRIGGER trg_supplier_portal_tokens_immutable
  BEFORE UPDATE ON public.supplier_portal_tokens
  FOR EACH ROW EXECUTE FUNCTION public.supplier_portal_tokens_protect_immutable();

DROP POLICY IF EXISTS "admins manage user_sectors" ON public.user_sectors;
CREATE POLICY "admins manage user_sectors" ON public.user_sectors FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));