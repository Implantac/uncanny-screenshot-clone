ALTER TABLE public.supplier_portal_attachments
  ADD COLUMN IF NOT EXISTS attachment_kind text NOT NULL DEFAULT 'document' CHECK (
    attachment_kind IN ('document', 'sample', 'photo', 'invoice', 'other')
  ),
  ADD COLUMN IF NOT EXISTS sample_status text NOT NULL DEFAULT 'received' CHECK (
    sample_status IN ('received', 'pending_review', 'approved', 'rejected', 'needs_adjustment')
  ),
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_spa_kind_status
  ON public.supplier_portal_attachments(owner_id, attachment_kind, sample_status);

INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-uploads', 'supplier-uploads', false)
ON CONFLICT (id) DO NOTHING;
