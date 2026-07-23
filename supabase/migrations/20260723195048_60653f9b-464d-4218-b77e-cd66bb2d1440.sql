
-- Workflow Engine + Stage Gates (Onda 1)
-- Função canônica que devolve o status dos gates de um produto.
-- Requisitos avaliados para liberar produto para produção (state='active'):
--   1. Ficha técnica aprovada
--   2. BOM com pelo menos 1 material
--   3. Custo final > 0
--   4. Grade de medidas com pelo menos 1 linha
--   5. Pelo menos 1 protótipo aprovado
--   6. Fornecedor vinculado (via protótipo aprovado ou produto)

CREATE OR REPLACE FUNCTION public.product_gate_status(_product_id uuid)
RETURNS TABLE (
  requirement text,
  ok boolean,
  detail text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_sheet_id uuid;
  v_sheet_status text;
  v_sheet_cost numeric;
  v_materials int := 0;
  v_measurements int := 0;
  v_approved_protos int := 0;
  v_supplier_ok boolean := false;
BEGIN
  SELECT owner_id INTO v_owner FROM public.products WHERE id = _product_id;
  IF v_owner IS NULL THEN
    RETURN;
  END IF;

  SELECT id, status, cost_price
    INTO v_sheet_id, v_sheet_status, v_sheet_cost
    FROM public.tech_sheets
   WHERE product_id = _product_id
     AND owner_id = v_owner
   ORDER BY (status = 'aprovada') DESC, updated_at DESC
   LIMIT 1;

  IF v_sheet_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_materials
      FROM public.tech_sheet_materials WHERE tech_sheet_id = v_sheet_id;
    SELECT COUNT(*) INTO v_measurements
      FROM public.tech_sheet_measurements WHERE tech_sheet_id = v_sheet_id;
  END IF;

  SELECT COUNT(*) INTO v_approved_protos
    FROM public.prototypes
   WHERE product_id = _product_id
     AND owner_id = v_owner
     AND stage = 'aprovado';

  SELECT EXISTS (
    SELECT 1 FROM public.prototypes
     WHERE product_id = _product_id AND owner_id = v_owner AND supplier_id IS NOT NULL
  ) INTO v_supplier_ok;

  requirement := 'Ficha técnica aprovada';
  ok := (v_sheet_status = 'aprovada');
  detail := CASE
    WHEN v_sheet_id IS NULL THEN 'Nenhuma ficha técnica cadastrada'
    WHEN v_sheet_status <> 'aprovada' THEN 'Ficha existe mas está ' || v_sheet_status
    ELSE 'Ficha aprovada'
  END;
  RETURN NEXT;

  requirement := 'BOM (materiais)';
  ok := (v_materials > 0);
  detail := v_materials::text || ' material(is) na ficha';
  RETURN NEXT;

  requirement := 'Custo definido';
  ok := (COALESCE(v_sheet_cost, 0) > 0);
  detail := CASE WHEN v_sheet_cost IS NULL OR v_sheet_cost = 0
                 THEN 'Custo zerado na ficha'
                 ELSE 'R$ ' || to_char(v_sheet_cost, 'FM999G999D00') END;
  RETURN NEXT;

  requirement := 'Grade de medidas';
  ok := (v_measurements > 0);
  detail := v_measurements::text || ' medida(s) cadastrada(s)';
  RETURN NEXT;

  requirement := 'Protótipo aprovado';
  ok := (v_approved_protos > 0);
  detail := v_approved_protos::text || ' protótipo(s) aprovado(s)';
  RETURN NEXT;

  requirement := 'Fornecedor vinculado';
  ok := v_supplier_ok;
  detail := CASE WHEN v_supplier_ok THEN 'Fornecedor definido em protótipo' ELSE 'Sem fornecedor vinculado' END;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.product_gate_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_gate_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.product_gate_status(uuid) TO service_role;

-- Helper booleano — pronto para uso em triggers/policies futuras
CREATE OR REPLACE FUNCTION public.can_advance_product(_product_id uuid, _target public.product_lifecycle_state)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _target IN ('active') THEN
      NOT EXISTS (SELECT 1 FROM public.product_gate_status(_product_id) WHERE ok = false)
    ELSE true
  END
$$;

REVOKE ALL ON FUNCTION public.can_advance_product(uuid, public.product_lifecycle_state) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_advance_product(uuid, public.product_lifecycle_state) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_advance_product(uuid, public.product_lifecycle_state) TO service_role;

-- Trigger advisory: registra em audit_logs toda transição de estado para rastreabilidade
-- (NÃO bloqueia — bloqueio hard fica reservado para quando o time confirmar o cutover)
CREATE OR REPLACE FUNCTION public.product_lifecycle_audit_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blockers int := 0;
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state THEN
    IF NEW.state = 'active' THEN
      SELECT COUNT(*) INTO v_blockers
        FROM public.product_gate_status(NEW.product_id) WHERE ok = false;
    END IF;

    INSERT INTO public.audit_logs(
      user_id, entity, entity_id, action, payload
    ) VALUES (
      COALESCE(auth.uid(), NEW.owner_id),
      'product_lifecycle',
      NEW.product_id,
      'state_transition',
      jsonb_build_object(
        'from', OLD.state,
        'to', NEW.state,
        'collection_id', NEW.collection_id,
        'blockers_when_activated', v_blockers
      )
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_product_lifecycle_audit_transition ON public.product_lifecycle;
CREATE TRIGGER trg_product_lifecycle_audit_transition
AFTER UPDATE ON public.product_lifecycle
FOR EACH ROW
EXECUTE FUNCTION public.product_lifecycle_audit_transition();
