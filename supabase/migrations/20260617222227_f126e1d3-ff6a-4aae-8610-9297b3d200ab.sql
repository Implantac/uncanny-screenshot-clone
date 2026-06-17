
CREATE TABLE public.tech_sheet_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  label text,
  notes text,
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tech_sheet_id, version_number)
);

CREATE INDEX idx_tsv_sheet ON public.tech_sheet_versions(tech_sheet_id, version_number DESC);
CREATE INDEX idx_tsv_owner ON public.tech_sheet_versions(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_versions TO authenticated;
GRANT ALL ON public.tech_sheet_versions TO service_role;

ALTER TABLE public.tech_sheet_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can view tsv" ON public.tech_sheet_versions
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "owner can insert tsv" ON public.tech_sheet_versions
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner can update tsv" ON public.tech_sheet_versions
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner can delete tsv" ON public.tech_sheet_versions
  FOR DELETE TO authenticated USING (owner_id = auth.uid());
