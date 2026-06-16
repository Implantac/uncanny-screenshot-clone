
CREATE TABLE public.supplier_portal_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_portal_tokens TO authenticated;
GRANT ALL ON public.supplier_portal_tokens TO service_role;
ALTER TABLE public.supplier_portal_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages supplier_portal_tokens" ON public.supplier_portal_tokens
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_supplier_portal_tokens_updated BEFORE UPDATE ON public.supplier_portal_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_supplier_portal_tokens_token ON public.supplier_portal_tokens(token);
