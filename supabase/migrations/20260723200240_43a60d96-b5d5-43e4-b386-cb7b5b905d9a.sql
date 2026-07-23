-- ONDA 2 — Timeline & Colaboração
CREATE TABLE public.product_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_watchers TO authenticated;
GRANT ALL ON public.product_watchers TO service_role;

ALTER TABLE public.product_watchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchers_select_own_tenant" ON public.product_watchers
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "watchers_insert_self" ON public.product_watchers
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND owner_id = auth.uid());

CREATE POLICY "watchers_delete_self" ON public.product_watchers
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_product_watchers_product ON public.product_watchers(product_id);
CREATE INDEX idx_product_watchers_user ON public.product_watchers(user_id);

-- Comments
CREATE TABLE public.product_timeline_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  event_id text,
  event_source text,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_timeline_comments TO authenticated;
GRANT ALL ON public.product_timeline_comments TO service_role;

ALTER TABLE public.product_timeline_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_comments_select_own_tenant" ON public.product_timeline_comments
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "timeline_comments_insert_self" ON public.product_timeline_comments
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND author_id = auth.uid());

CREATE POLICY "timeline_comments_update_own" ON public.product_timeline_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND owner_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "timeline_comments_delete_own" ON public.product_timeline_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND owner_id = auth.uid());

CREATE INDEX idx_timeline_comments_product ON public.product_timeline_comments(product_id, created_at DESC);
CREATE INDEX idx_timeline_comments_event ON public.product_timeline_comments(event_id) WHERE event_id IS NOT NULL;

CREATE TRIGGER trg_timeline_comments_updated_at
  BEFORE UPDATE ON public.product_timeline_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Attachments
CREATE TABLE public.product_timeline_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.product_timeline_comments(id) ON DELETE CASCADE,
  event_id text,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_timeline_attachments TO authenticated;
GRANT ALL ON public.product_timeline_attachments TO service_role;

ALTER TABLE public.product_timeline_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timeline_attachments_select_own_tenant" ON public.product_timeline_attachments
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "timeline_attachments_insert_self" ON public.product_timeline_attachments
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND uploaded_by = auth.uid());

CREATE POLICY "timeline_attachments_delete_own" ON public.product_timeline_attachments
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() AND owner_id = auth.uid());

CREATE INDEX idx_timeline_attachments_product ON public.product_timeline_attachments(product_id, created_at DESC);
CREATE INDEX idx_timeline_attachments_comment ON public.product_timeline_attachments(comment_id) WHERE comment_id IS NOT NULL;

-- Storage policies (bucket 'product-timeline' já existe)
CREATE POLICY "product_timeline_read_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'product-timeline'
    AND EXISTS (
      SELECT 1 FROM public.product_timeline_attachments a
       WHERE a.storage_path = storage.objects.name
         AND a.owner_id = auth.uid()
    )
  );

CREATE POLICY "product_timeline_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-timeline'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "product_timeline_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-timeline'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );