
-- Frente 1: BOM por tamanho
ALTER TABLE public.tech_sheet_materials
  ADD COLUMN IF NOT EXISTS consumption_by_size jsonb;

-- Frente 2: Lead time real
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS lead_time_days integer;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS suggested_order_date date;

-- Frente 4: Facção 360°
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS expected_return_date date,
  ADD COLUMN IF NOT EXISTS qty_lost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qty_defect numeric NOT NULL DEFAULT 0;

-- Frente 3: Time & Action
DO $$ BEGIN
  CREATE TYPE public.collection_milestone_stage AS ENUM (
    'briefing','moodboard','tech_pack','piloto','aprovacao','producao','lancamento'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.collection_milestone_status AS ENUM (
    'pendente','em_andamento','concluido','atrasado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.collection_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  stage public.collection_milestone_stage NOT NULL,
  planned_date date,
  actual_date date,
  sla_days integer,
  responsible_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.collection_milestone_status NOT NULL DEFAULT 'pendente',
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_collection_milestones_owner ON public.collection_milestones(owner_id);
CREATE INDEX IF NOT EXISTS idx_collection_milestones_collection ON public.collection_milestones(collection_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_milestones TO authenticated;
GRANT ALL ON public.collection_milestones TO service_role;

ALTER TABLE public.collection_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own milestones select" ON public.collection_milestones
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own milestones insert" ON public.collection_milestones
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own milestones update" ON public.collection_milestones
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own milestones delete" ON public.collection_milestones
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER trg_collection_milestones_updated_at
  BEFORE UPDATE ON public.collection_milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: marca actual_date e status do milestone correspondente quando a coleção avança
CREATE OR REPLACE FUNCTION public.collections_sync_milestone_actual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_stage public.collection_milestone_stage;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  v_stage := CASE NEW.status
    WHEN 'desenvolvimento' THEN 'tech_pack'::public.collection_milestone_stage
    WHEN 'producao'        THEN 'producao'::public.collection_milestone_stage
    WHEN 'lancamento'      THEN 'lancamento'::public.collection_milestone_stage
    ELSE NULL
  END;
  IF v_stage IS NULL THEN RETURN NEW; END IF;

  UPDATE public.collection_milestones
     SET actual_date = COALESCE(actual_date, CURRENT_DATE),
         status = 'concluido',
         updated_at = now()
   WHERE collection_id = NEW.id
     AND owner_id = NEW.owner_id
     AND stage = v_stage;

  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_collections_sync_milestone ON public.collections;
CREATE TRIGGER trg_collections_sync_milestone
  AFTER UPDATE OF status ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.collections_sync_milestone_actual();
