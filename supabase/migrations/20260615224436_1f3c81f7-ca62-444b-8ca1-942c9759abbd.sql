
-- Extra cost fields on tech_sheets
ALTER TABLE public.tech_sheets
  ADD COLUMN IF NOT EXISTS materials_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labor_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overhead_pct numeric NOT NULL DEFAULT 0;

-- 1) Materials (BOM)
CREATE TABLE IF NOT EXISTS public.tech_sheet_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  consumption numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'un',
  loss_pct numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric GENERATED ALWAYS AS (consumption * (1 + loss_pct/100.0) * unit_cost) STORED,
  position int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_materials TO authenticated;
GRANT ALL ON public.tech_sheet_materials TO service_role;
ALTER TABLE public.tech_sheet_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own materials select" ON public.tech_sheet_materials FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own materials insert" ON public.tech_sheet_materials FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own materials update" ON public.tech_sheet_materials FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own materials delete" ON public.tech_sheet_materials FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER tsm_updated BEFORE UPDATE ON public.tech_sheet_materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tsm_ts_idx ON public.tech_sheet_materials(tech_sheet_id);

-- 2) Operations
CREATE TABLE IF NOT EXISTS public.tech_sheet_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  name text NOT NULL,
  machine text,
  sam numeric NOT NULL DEFAULT 0,
  rate_per_min numeric NOT NULL DEFAULT 0,
  total_cost numeric GENERATED ALWAYS AS (sam * rate_per_min) STORED,
  position int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_operations TO authenticated;
GRANT ALL ON public.tech_sheet_operations TO service_role;
ALTER TABLE public.tech_sheet_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ops select" ON public.tech_sheet_operations FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own ops insert" ON public.tech_sheet_operations FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own ops update" ON public.tech_sheet_operations FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own ops delete" ON public.tech_sheet_operations FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER tso_updated BEFORE UPDATE ON public.tech_sheet_operations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tso_ts_idx ON public.tech_sheet_operations(tech_sheet_id);

-- 3) Measurements (POM)
CREATE TABLE IF NOT EXISTS public.tech_sheet_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  point text NOT NULL,
  tolerance_plus numeric NOT NULL DEFAULT 0,
  tolerance_minus numeric NOT NULL DEFAULT 0,
  sizes jsonb NOT NULL DEFAULT '{}'::jsonb,
  position int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_measurements TO authenticated;
GRANT ALL ON public.tech_sheet_measurements TO service_role;
ALTER TABLE public.tech_sheet_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meas select" ON public.tech_sheet_measurements FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own meas insert" ON public.tech_sheet_measurements FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own meas update" ON public.tech_sheet_measurements FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own meas delete" ON public.tech_sheet_measurements FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER tsmes_updated BEFORE UPDATE ON public.tech_sheet_measurements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tsmes_ts_idx ON public.tech_sheet_measurements(tech_sheet_id);

-- 4) Labels
CREATE TABLE IF NOT EXISTS public.tech_sheet_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  kind text NOT NULL,
  content text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_labels TO authenticated;
GRANT ALL ON public.tech_sheet_labels TO service_role;
ALTER TABLE public.tech_sheet_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lbl select" ON public.tech_sheet_labels FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own lbl insert" ON public.tech_sheet_labels FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own lbl update" ON public.tech_sheet_labels FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own lbl delete" ON public.tech_sheet_labels FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER tsl_updated BEFORE UPDATE ON public.tech_sheet_labels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tsl_ts_idx ON public.tech_sheet_labels(tech_sheet_id);

-- 5) Attachments
CREATE TABLE IF NOT EXISTS public.tech_sheet_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  mime_type text,
  size_bytes bigint,
  kind text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_attachments TO authenticated;
GRANT ALL ON public.tech_sheet_attachments TO service_role;
ALTER TABLE public.tech_sheet_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own att select" ON public.tech_sheet_attachments FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own att insert" ON public.tech_sheet_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own att update" ON public.tech_sheet_attachments FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own att delete" ON public.tech_sheet_attachments FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX IF NOT EXISTS tsa_ts_idx ON public.tech_sheet_attachments(tech_sheet_id);

-- 6) Recompute trigger
CREATE OR REPLACE FUNCTION public.tech_sheets_recompute_costs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ts_id uuid;
  mat numeric;
  lab numeric;
  oh numeric;
BEGIN
  ts_id := COALESCE(NEW.tech_sheet_id, OLD.tech_sheet_id);
  SELECT COALESCE(SUM(total_cost),0) INTO mat FROM public.tech_sheet_materials WHERE tech_sheet_id = ts_id;
  SELECT COALESCE(SUM(total_cost),0) INTO lab FROM public.tech_sheet_operations WHERE tech_sheet_id = ts_id;
  SELECT COALESCE(overhead_pct,0) INTO oh FROM public.tech_sheets WHERE id = ts_id;
  UPDATE public.tech_sheets
    SET materials_cost = mat,
        labor_cost = lab,
        cost_price = (mat + lab) * (1 + COALESCE(oh,0)/100.0),
        updated_at = now()
    WHERE id = ts_id;
  RETURN NULL;
END $$;

CREATE TRIGGER tsm_recompute AFTER INSERT OR UPDATE OR DELETE ON public.tech_sheet_materials
  FOR EACH ROW EXECUTE FUNCTION public.tech_sheets_recompute_costs();
CREATE TRIGGER tso_recompute AFTER INSERT OR UPDATE OR DELETE ON public.tech_sheet_operations
  FOR EACH ROW EXECUTE FUNCTION public.tech_sheets_recompute_costs();

-- When overhead_pct changes on tech_sheets itself, also recompute
CREATE OR REPLACE FUNCTION public.tech_sheets_overhead_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE mat numeric; lab numeric;
BEGIN
  IF NEW.overhead_pct IS DISTINCT FROM OLD.overhead_pct THEN
    SELECT COALESCE(SUM(total_cost),0) INTO mat FROM public.tech_sheet_materials WHERE tech_sheet_id = NEW.id;
    SELECT COALESCE(SUM(total_cost),0) INTO lab FROM public.tech_sheet_operations WHERE tech_sheet_id = NEW.id;
    NEW.materials_cost := mat;
    NEW.labor_cost := lab;
    NEW.cost_price := (mat + lab) * (1 + COALESCE(NEW.overhead_pct,0)/100.0);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ts_overhead_recompute BEFORE UPDATE ON public.tech_sheets
  FOR EACH ROW EXECUTE FUNCTION public.tech_sheets_overhead_recompute();
