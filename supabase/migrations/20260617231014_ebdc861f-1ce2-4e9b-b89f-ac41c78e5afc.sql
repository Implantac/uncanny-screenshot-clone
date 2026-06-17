
CREATE TABLE public.quality_capa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  inspection_id UUID REFERENCES public.quality_inspections(id) ON DELETE SET NULL,
  occurrence_id UUID REFERENCES public.production_occurrences(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.production_orders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  root_cause TEXT,
  corrective_action TEXT,
  preventive_action TEXT,
  severity TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'aberta',
  assigned_to UUID,
  due_date DATE,
  closed_at TIMESTAMPTZ,
  effectiveness_check TEXT,
  verified_by UUID,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_capa TO authenticated;
GRANT ALL ON public.quality_capa TO service_role;

ALTER TABLE public.quality_capa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own CAPAs"
  ON public.quality_capa FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_quality_capa_owner ON public.quality_capa(owner_id);
CREATE INDEX idx_quality_capa_status ON public.quality_capa(owner_id, status);
CREATE INDEX idx_quality_capa_supplier ON public.quality_capa(supplier_id) WHERE supplier_id IS NOT NULL;

CREATE TRIGGER update_quality_capa_updated_at
  BEFORE UPDATE ON public.quality_capa
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
