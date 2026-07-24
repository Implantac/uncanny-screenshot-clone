
-- 1) Enum de etapas
DO $$ BEGIN
  CREATE TYPE public.product_workflow_step AS ENUM (
    'concepcao',
    'modelagem',
    'engenharia',
    'custos',
    'piloto',
    'aprov_comercial',
    'aprov_diretoria',
    'liberacao_pcp',
    'producao'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.product_workflow_status AS ENUM (
    'pendente',
    'em_andamento',
    'concluido',
    'bloqueado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabela
CREATE TABLE IF NOT EXISTS public.product_workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  step public.product_workflow_step NOT NULL,
  step_order int NOT NULL,
  owner_role text,
  assignee_id uuid,
  status public.product_workflow_status NOT NULL DEFAULT 'pendente',
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid,
  blocker_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, step)
);

CREATE INDEX IF NOT EXISTS idx_pws_owner_status ON public.product_workflow_steps(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_pws_assignee_status ON public.product_workflow_steps(assignee_id, status) WHERE status IN ('em_andamento','pendente');
CREATE INDEX IF NOT EXISTS idx_pws_product_order ON public.product_workflow_steps(product_id, step_order);

-- 3) GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_workflow_steps TO authenticated;
GRANT ALL ON public.product_workflow_steps TO service_role;

-- 4) RLS
ALTER TABLE public.product_workflow_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pws_owner_all ON public.product_workflow_steps;
CREATE POLICY pws_owner_all ON public.product_workflow_steps
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- 5) updated_at trigger
DROP TRIGGER IF EXISTS trg_pws_updated ON public.product_workflow_steps;
CREATE TRIGGER trg_pws_updated
  BEFORE UPDATE ON public.product_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Seed function
CREATE OR REPLACE FUNCTION public.product_workflow_seed(_product_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_count int := 0;
  v_steps text[][] := ARRAY[
    ['concepcao',       '1', 'designer',   'Concepção'],
    ['modelagem',       '2', 'modelista',  'Modelagem'],
    ['engenharia',      '3', 'engenharia', 'Engenharia / Ficha técnica'],
    ['custos',          '4', 'comprador',  'Custos e fornecedor'],
    ['piloto',          '5', 'piloto',     'Pilotagem'],
    ['aprov_comercial', '6', 'vendedor',   'Aprovação comercial'],
    ['aprov_diretoria', '7', 'admin',      'Aprovação diretoria'],
    ['liberacao_pcp',   '8', 'pcp',        'Liberação PCP'],
    ['producao',        '9', 'pcp',        'Produção']
  ];
  v_row text[];
BEGIN
  SELECT owner_id INTO v_owner FROM public.products WHERE id = _product_id;
  IF v_owner IS NULL THEN RETURN 0; END IF;

  FOREACH v_row SLICE 1 IN ARRAY v_steps LOOP
    INSERT INTO public.product_workflow_steps(
      owner_id, product_id, step, step_order, owner_role, status
    ) VALUES (
      v_owner, _product_id,
      v_row[1]::public.product_workflow_step,
      v_row[2]::int,
      v_row[3],
      CASE WHEN v_row[2]::int = 1 THEN 'em_andamento'::public.product_workflow_status
           ELSE 'pendente'::public.product_workflow_status END
    ) ON CONFLICT (product_id, step) DO NOTHING;
    IF FOUND THEN v_count := v_count + 1; END IF;
  END LOOP;

  -- garante que a primeira etapa tenha started_at
  UPDATE public.product_workflow_steps
     SET started_at = COALESCE(started_at, now())
   WHERE product_id = _product_id AND step_order = 1;

  RETURN v_count;
END $$;

-- 7) Advance function (com gate-check)
CREATE OR REPLACE FUNCTION public.product_workflow_advance(_product_id uuid, _note text DEFAULT NULL)
RETURNS TABLE(advanced boolean, from_step text, to_step text, blockers text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current RECORD;
  v_next RECORD;
  v_blockers text[] := ARRAY[]::text[];
  r RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- semeia se necessário
  IF NOT EXISTS (SELECT 1 FROM public.product_workflow_steps WHERE product_id = _product_id) THEN
    PERFORM public.product_workflow_seed(_product_id);
  END IF;

  SELECT * INTO v_current
    FROM public.product_workflow_steps
   WHERE product_id = _product_id
     AND owner_id = v_uid
     AND status = 'em_andamento'
   ORDER BY step_order ASC
   LIMIT 1;

  IF NOT FOUND THEN
    -- retoma a primeira pendente
    SELECT * INTO v_current
      FROM public.product_workflow_steps
     WHERE product_id = _product_id
       AND owner_id = v_uid
       AND status = 'pendente'
     ORDER BY step_order ASC
     LIMIT 1;
    IF NOT FOUND THEN
      RETURN QUERY SELECT false, NULL::text, NULL::text, ARRAY['Nenhuma etapa em andamento']::text[];
      RETURN;
    END IF;
    UPDATE public.product_workflow_steps
       SET status = 'em_andamento', started_at = COALESCE(started_at, now())
     WHERE id = v_current.id;
  END IF;

  SELECT * INTO v_next
    FROM public.product_workflow_steps
   WHERE product_id = _product_id
     AND owner_id = v_uid
     AND step_order = v_current.step_order + 1
   LIMIT 1;

  -- Gate-check: liberação PCP e produção exigem todos os gates verdes
  IF v_next.step::text IN ('liberacao_pcp','producao') THEN
    FOR r IN
      SELECT requirement, detail FROM public.product_gate_status(_product_id) WHERE ok = false
    LOOP
      v_blockers := array_append(v_blockers, r.requirement || COALESCE(' — ' || r.detail, ''));
    END LOOP;

    IF array_length(v_blockers,1) IS NOT NULL THEN
      UPDATE public.product_workflow_steps
         SET status = 'bloqueado', blocker_reason = array_to_string(v_blockers, E'\n'), updated_at = now()
       WHERE id = v_current.id;
      RETURN QUERY SELECT false, v_current.step::text, v_next.step::text, v_blockers;
      RETURN;
    END IF;
  END IF;

  -- Conclui a atual
  UPDATE public.product_workflow_steps
     SET status = 'concluido',
         completed_at = now(),
         completed_by = v_uid,
         blocker_reason = NULL,
         notes = COALESCE(_note, notes),
         updated_at = now()
   WHERE id = v_current.id;

  -- Abre a próxima (se houver)
  IF v_next.id IS NOT NULL THEN
    UPDATE public.product_workflow_steps
       SET status = 'em_andamento',
           started_at = COALESCE(started_at, now()),
           updated_at = now()
     WHERE id = v_next.id;
  END IF;

  PERFORM public.log_audit(
    'product_workflow', _product_id, 'advance',
    jsonb_build_object('from', v_current.step, 'to', v_next.step, 'note', _note)
  );

  RETURN QUERY SELECT true, v_current.step::text, COALESCE(v_next.step::text, NULL), ARRAY[]::text[];
END $$;

-- 8) Trigger no CREATE de produto
CREATE OR REPLACE FUNCTION public.products_seed_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.product_workflow_seed(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_seed_workflow ON public.products;
CREATE TRIGGER trg_products_seed_workflow
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_seed_workflow();

-- 9) Backfill: semear workflow para produtos existentes
DO $$
DECLARE r RECORD; BEGIN
  FOR r IN SELECT id FROM public.products LOOP
    PERFORM public.product_workflow_seed(r.id);
  END LOOP;
END $$;

-- 10) View "minhas tarefas de workflow"
CREATE OR REPLACE VIEW public.v_my_workflow_tasks AS
SELECT
  s.id,
  s.owner_id,
  s.product_id,
  p.name AS product_name,
  p.sku AS product_sku,
  p.image_url AS product_image,
  s.step,
  s.step_order,
  s.status,
  s.owner_role,
  s.started_at,
  s.blocker_reason,
  s.updated_at
FROM public.product_workflow_steps s
JOIN public.products p ON p.id = s.product_id
WHERE s.status IN ('em_andamento','bloqueado')
  AND s.owner_id = auth.uid();

GRANT SELECT ON public.v_my_workflow_tasks TO authenticated;
