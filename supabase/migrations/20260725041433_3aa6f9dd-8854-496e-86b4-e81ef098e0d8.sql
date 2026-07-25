
-- =========================================================
-- Onda B — Gates bloqueantes em production_orders
-- =========================================================

-- 1) Trigger function: valida gates críticos antes de inserir OP
CREATE OR REPLACE FUNCTION public.production_orders_enforce_gates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  bypass text;
  r record;
  failed text[] := ARRAY[]::text[];
  critical text[] := ARRAY[
    'Ficha técnica aprovada',
    'BOM (materiais)',
    'Custo definido',
    'Protótipo aprovado'
  ];
BEGIN
  -- OP sem produto vinculado (ex.: importadas do ERP) não passa por gates
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Bypass controlado por sessão (auto-flows e admin com justificativa)
  bypass := current_setting('app.bypass_gates', true);
  IF bypass = 'on' THEN
    RETURN NEW;
  END IF;

  FOR r IN SELECT * FROM public.product_gate_status(NEW.product_id) LOOP
    IF r.requirement = ANY (critical) AND NOT r.ok THEN
      failed := failed || (r.requirement || ' — ' || COALESCE(r.detail, ''));
    END IF;
  END LOOP;

  IF array_length(failed, 1) > 0 THEN
    RAISE EXCEPTION
      'Não é possível criar a OP: produto não passou nos gates obrigatórios. Pendências: %',
      array_to_string(failed, ' | ')
      USING ERRCODE = 'check_violation',
            HINT   = 'Conclua os requisitos no Product Workspace ou use a criação forçada (admin) com justificativa.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS production_orders_enforce_gates ON public.production_orders;
CREATE TRIGGER production_orders_enforce_gates
  BEFORE INSERT ON public.production_orders
  FOR EACH ROW EXECUTE FUNCTION public.production_orders_enforce_gates();

-- 2) Auto-flow protótipo → OP: preservar comportamento existente com bypass local
CREATE OR REPLACE FUNCTION public.prototypes_to_production_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  marker text;
  next_code text;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.stage <> 'aprovado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.stage = 'aprovado' THEN RETURN NEW; END IF;

  marker := '[proto:' || NEW.id::text || ']';

  IF EXISTS (
    SELECT 1 FROM public.production_orders
     WHERE owner_id = NEW.owner_id
       AND notes LIKE '%' || marker || '%'
  ) THEN
    RETURN NEW;
  END IF;

  next_code := 'OP-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(NEW.id::text,'-',''),1,6);

  -- Bypass gates: OP gerada automaticamente pela aprovação do protótipo
  PERFORM set_config('app.bypass_gates', 'on', true);

  INSERT INTO public.production_orders(
    owner_id, product_id, supplier_id, code, quantity, status, stage, notes
  ) VALUES (
    NEW.owner_id, NEW.product_id, NEW.supplier_id, next_code, 0,
    'aguardando', 'compras',
    'Gerada automaticamente do protótipo ' || NEW.code || ' ' || marker
  );

  PERFORM set_config('app.bypass_gates', 'off', true);

  RETURN NEW;
END;
$$;

-- 3) Criação forçada por admin (com justificativa auditada)
CREATE OR REPLACE FUNCTION public.create_production_order_force(
  _payload jsonb,
  _reason  text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF NOT public.has_role(v_uid, 'admin') THEN
    RAISE EXCEPTION 'Apenas admins podem forçar criação de OP com gates pendentes'
      USING ERRCODE = '42501';
  END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 8 THEN
    RAISE EXCEPTION 'Justificativa obrigatória (mínimo 8 caracteres)'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.bypass_gates', 'on', true);

  INSERT INTO public.production_orders(
    owner_id, product_id, supplier_id, code, quantity, progress, due_date,
    status, stage, priority, notes, batch_code
  )
  SELECT
    v_uid,
    NULLIF(_payload->>'product_id','')::uuid,
    NULLIF(_payload->>'supplier_id','')::uuid,
    _payload->>'code',
    COALESCE((_payload->>'quantity')::int, 0),
    LEAST(100, GREATEST(0, COALESCE((_payload->>'progress')::int, 0))),
    NULLIF(_payload->>'due_date','')::date,
    COALESCE((_payload->>'status')::production_status, 'aguardando'),
    COALESCE((_payload->>'stage')::production_stage, 'compras'),
    COALESCE((_payload->>'priority')::smallint, 3::smallint),
    COALESCE(_payload->>'notes','') ||
      E'\n[FORCE-CREATE por admin ' || v_uid::text || ']: ' || _reason,
    NULLIF(_payload->>'batch_code','')
  RETURNING id INTO v_id;

  PERFORM set_config('app.bypass_gates', 'off', true);

  PERFORM public.log_audit(
    'production_orders',
    v_id,
    'force_create',
    jsonb_build_object('reason', _reason, 'payload', _payload)
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_production_order_force(jsonb, text) FROM public;
GRANT  EXECUTE ON FUNCTION public.create_production_order_force(jsonb, text) TO authenticated;
