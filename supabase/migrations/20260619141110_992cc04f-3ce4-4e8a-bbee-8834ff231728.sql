
-- Restore columns expected by supplier portal code
DO $$ BEGIN
  CREATE TYPE public.attachment_kind AS ENUM ('sample','photo','document','invoice','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sample_review_status AS ENUM ('pending_review','approved','needs_adjustment','received','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.supplier_portal_attachments
  ADD COLUMN IF NOT EXISTS attachment_kind public.attachment_kind NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS sample_status public.sample_review_status,
  ADD COLUMN IF NOT EXISTS checklist jsonb,
  ADD COLUMN IF NOT EXISTS inspection_notes text,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_supplier_portal_attachments_kind
  ON public.supplier_portal_attachments(attachment_kind);
