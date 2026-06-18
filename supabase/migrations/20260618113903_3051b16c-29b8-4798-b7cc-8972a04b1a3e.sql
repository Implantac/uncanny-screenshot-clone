
CREATE TABLE IF NOT EXISTS public.bom_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  category text,
  source_sheet_id uuid REFERENCES public.tech_sheets(id) ON DELETE SET NULL,
  materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  operations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_templates TO authenticated;
GRANT ALL ON public.bom_templates TO service_role;

ALTER TABLE public.bom_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages bom templates" ON public.bom_templates
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER bom_templates_updated_at
  BEFORE UPDATE ON public.bom_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_bom_templates_owner ON public.bom_templates(owner_id, name);
