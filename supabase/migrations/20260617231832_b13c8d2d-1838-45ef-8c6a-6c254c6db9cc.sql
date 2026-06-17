
CREATE TABLE public.supplier_portal_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  rfq_id UUID REFERENCES public.rfq_requests(id) ON DELETE CASCADE,
  production_order_id UUID REFERENCES public.production_orders(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime TEXT,
  size INTEGER,
  uploaded_via TEXT NOT NULL DEFAULT 'portal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_portal_attachments TO authenticated;
GRANT ALL ON public.supplier_portal_attachments TO service_role;
ALTER TABLE public.supplier_portal_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read attachments" ON public.supplier_portal_attachments FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete attachments" ON public.supplier_portal_attachments FOR DELETE USING (auth.uid() = owner_id);
CREATE INDEX idx_spa_owner ON public.supplier_portal_attachments(owner_id);
CREATE INDEX idx_spa_supplier ON public.supplier_portal_attachments(supplier_id);

CREATE TABLE public.supplier_portal_acks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  production_order_id UUID NOT NULL REFERENCES public.production_orders(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  counter_due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_portal_acks TO authenticated;
GRANT ALL ON public.supplier_portal_acks TO service_role;
ALTER TABLE public.supplier_portal_acks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read acks" ON public.supplier_portal_acks FOR SELECT USING (auth.uid() = owner_id);
CREATE INDEX idx_spack_order ON public.supplier_portal_acks(production_order_id);

CREATE POLICY "Owners read supplier uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'supplier-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
