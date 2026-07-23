
-- ============ Wave 3: Extended Stage Gates + Approvals ============

-- 1) Extend product_gate_status with 3 new critical requirements
CREATE OR REPLACE FUNCTION public.product_gate_status(_product_id uuid)
 RETURNS TABLE(requirement text, ok boolean, detail text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_sheet_id uuid;
  v_sheet_status text;
  v_sheet_cost numeric;
  v_materials int := 0;
  v_measurements int := 0;
  v_approved_protos int := 0;
  v_supplier_ok boolean := false;
  v_sizes int := 0;
  v_routing int := 0;
  v_target_cost numeric;
  v_target_margin numeric;
BEGIN
  SELECT owner_id INTO v_owner FROM public.products WHERE id = _product_id;
  IF v_owner IS NULL THEN RETURN; END IF;

  SELECT id, status, cost_price INTO v_sheet_id, v_sheet_status, v_sheet_cost
    FROM public.tech_sheets
   WHERE product_id = _product_id AND owner_id = v_owner
   ORDER BY (status = 'aprovada') DESC, updated_at DESC
   LIMIT 1;

  IF v_sheet_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_materials FROM public.tech_sheet_materials WHERE tech_sheet_id = v_sheet_id;
    SELECT COUNT(*) INTO v_measurements FROM public.tech_sheet_measurements WHERE tech_sheet_id = v_sheet_id;
  END IF;

  SELECT COUNT(*) INTO v_approved_protos
    FROM public.prototypes WHERE product_id = _product_id AND owner_id = v_owner AND stage = 'aprovado';

  SELECT EXISTS (
    SELECT 1 FROM public.prototypes
     WHERE product_id = _product_id AND owner_id = v_owner AND supplier_id IS NOT NULL
  ) INTO v_supplier_ok;

  SELECT COUNT(*) INTO v_sizes FROM public.product_size_options
   WHERE product_id = _product_id AND owner_id = v_owner AND active = true;

  SELECT COUNT(*) INTO v_routing FROM public.product_routing
   WHERE product_id = _product_id AND owner_id = v_owner;

  SELECT target_cost, target_margin_pct INTO v_target_cost, v_target_margin
    FROM public.product_target_costs
   WHERE product_id = _product_id AND owner_id = v_owner
   ORDER BY updated_at DESC LIMIT 1;

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
  detail := CASE WHEN v_sheet_cost IS NULL OR v_sheet_cost = 0 THEN 'Custo zerado na ficha'
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

  requirement := 'Grade de tamanhos';
  ok := (v_sizes > 0);
  detail := v_sizes::text || ' tamanho(s) ativo(s)';
  RETURN NEXT;

  requirement := 'Rota de produção';
  ok := (v_routing > 0);
  detail := v_routing::text || ' etapa(s) de roteiro definida(s)';
  RETURN NEXT;

  requirement := 'Meta de custo respeitada';
  ok := (v_target_cost IS NOT NULL AND v_sheet_cost IS NOT NULL AND v_sheet_cost > 0 AND v_sheet_cost <= v_target_cost);
  detail := CASE
    WHEN v_target_cost IS NULL THEN 'Meta de custo não definida'
    WHEN v_sheet_cost IS NULL OR v_sheet_cost = 0 THEN 'Custo da ficha ainda não calculado'
    WHEN v_sheet_cost <= v_target_cost THEN 'Custo R$ ' || to_char(v_sheet_cost,'FM999G999D00') || ' ≤ meta R$ ' || to_char(v_target_cost,'FM999G999D00')
    ELSE 'Custo R$ ' || to_char(v_sheet_cost,'FM999G999D00') || ' acima da meta R$ ' || to_char(v_target_cost,'FM999G999D00')
  END;
  RETURN NEXT;
END;
$function$;

-- 2) Approvals table
CREATE TABLE IF NOT EXISTS public.product_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  gate_key text NOT NULL,
  required_role public.app_role,
  approver_id uuid,
  decision text NOT NULL DEFAULT 'pendente' CHECK (decision IN ('pendente','aprovado','rejeitado')),
  note text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_approvals_product ON public.product_approvals(product_id);
CREATE INDEX IF NOT EXISTS idx_product_approvals_owner ON public.product_approvals(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_approvals_pending ON public.product_approvals(product_id, gate_key) WHERE decision = 'pendente';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_approvals TO authenticated;
GRANT ALL ON public.product_approvals TO service_role;

ALTER TABLE public.product_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage product approvals"
  ON public.product_approvals FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_product_approvals_updated_at
  BEFORE UPDATE ON public.product_approvals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Stamp decided_at when decision leaves pendente
CREATE OR REPLACE FUNCTION public.product_approvals_stamp_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.decision <> 'pendente' AND (TG_OP = 'INSERT' OR OLD.decision IS DISTINCT FROM NEW.decision) THEN
    NEW.decided_at := COALESCE(NEW.decided_at, now());
    NEW.approver_id := COALESCE(NEW.approver_id, auth.uid());
    PERFORM public.log_audit('product_approval', NEW.product_id, 'gate_' || NEW.decision,
      jsonb_build_object('gate_key', NEW.gate_key, 'note', NEW.note));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_product_approvals_stamp
  BEFORE INSERT OR UPDATE ON public.product_approvals
  FOR EACH ROW EXECUTE FUNCTION public.product_approvals_stamp_decision();
