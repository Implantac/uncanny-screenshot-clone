
-- supplier_capabilities
CREATE TABLE public.supplier_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  capability text NOT NULL,
  monthly_capacity numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, capability)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_capabilities TO authenticated;
GRANT ALL ON public.supplier_capabilities TO service_role;
ALTER TABLE public.supplier_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own supplier_capabilities" ON public.supplier_capabilities FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_supplier_capabilities_updated BEFORE UPDATE ON public.supplier_capabilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- supplier_compliance
CREATE TABLE public.supplier_compliance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  cert_type text NOT NULL,
  cert_number text,
  issuer text,
  issued_at date,
  expires_at date,
  attachment_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_compliance TO authenticated;
GRANT ALL ON public.supplier_compliance TO service_role;
ALTER TABLE public.supplier_compliance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own supplier_compliance" ON public.supplier_compliance FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_supplier_compliance_updated BEFORE UPDATE ON public.supplier_compliance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- quality_inspections
CREATE TABLE public.quality_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  inspection_type text NOT NULL DEFAULT 'final',
  production_order_id uuid REFERENCES public.production_orders(id) ON DELETE SET NULL,
  service_order_id uuid REFERENCES public.service_orders(id) ON DELETE SET NULL,
  prototype_id uuid REFERENCES public.prototypes(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  aql_level text,
  lot_size integer,
  sample_size integer,
  critical_defects integer NOT NULL DEFAULT 0,
  major_defects integer NOT NULL DEFAULT 0,
  minor_defects integer NOT NULL DEFAULT 0,
  result text NOT NULL DEFAULT 'pendente',
  inspector text,
  notes text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  inspected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_inspections TO authenticated;
GRANT ALL ON public.quality_inspections TO service_role;
ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quality_inspections" ON public.quality_inspections FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE TRIGGER trg_quality_inspections_updated BEFORE UPDATE ON public.quality_inspections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_qi_owner ON public.quality_inspections(owner_id);
CREATE INDEX idx_qi_po ON public.quality_inspections(production_order_id);
CREATE INDEX idx_qi_so ON public.quality_inspections(service_order_id);
CREATE INDEX idx_sc_owner ON public.supplier_capabilities(owner_id);
CREATE INDEX idx_scmp_owner ON public.supplier_compliance(owner_id);
