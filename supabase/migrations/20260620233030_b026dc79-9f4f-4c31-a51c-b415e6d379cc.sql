
CREATE TABLE IF NOT EXISTS public.quality_capa_rules (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  fpy_threshold numeric NOT NULL DEFAULT 80,
  max_critical_defects integer NOT NULL DEFAULT 0,
  min_occurrences integer NOT NULL DEFAULT 3,
  window_days integer NOT NULL DEFAULT 90,
  min_inspections integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_capa_rules TO authenticated;
GRANT ALL ON public.quality_capa_rules TO service_role;

ALTER TABLE public.quality_capa_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own capa rules"
  ON public.quality_capa_rules FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER trg_quality_capa_rules_updated_at
  BEFORE UPDATE ON public.quality_capa_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atualiza a função de automação para ler regras dinâmicas
CREATE OR REPLACE FUNCTION public.influencer_shipments_autocapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean := true;
  v_fpy_thr numeric := 80;
  v_max_crit int := 0;
  v_min_occs int := 3;
  v_window int := 90;
  v_min_insp int := 3;
  v_since timestamptz;
  v_total int := 0;
  v_approved int := 0;
  v_fpy numeric := 100;
  v_occs int := 0;
  v_critical_defs int := 0;
  v_product_name text;
  v_product_sku text;
  v_influencer_name text;
  v_is_critical boolean := false;
  v_reason text;
  v_marker text;
  v_severity text;
BEGIN
  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;

  -- carrega regras (ou usa defaults)
  SELECT enabled, fpy_threshold, max_critical_defects, min_occurrences, window_days, min_inspections
    INTO v_enabled, v_fpy_thr, v_max_crit, v_min_occs, v_window, v_min_insp
    FROM public.quality_capa_rules WHERE owner_id = NEW.owner_id;

  IF NOT v_enabled THEN RETURN NEW; END IF;

  v_since := now() - (v_window || ' days')::interval;
  v_marker := '[ship-capa:' || NEW.id::text || ']';

  IF EXISTS (
    SELECT 1 FROM public.quality_capa
     WHERE owner_id = NEW.owner_id
       AND problem LIKE '%' || v_marker || '%'
  ) THEN RETURN NEW; END IF;

  SELECT name, sku INTO v_product_name, v_product_sku
    FROM public.products WHERE id = NEW.product_id;
  SELECT nome INTO v_influencer_name
    FROM public.influencers WHERE id = NEW.influencer_id;

  SELECT
    COUNT(*) FILTER (WHERE qi.created_at >= v_since),
    COUNT(*) FILTER (WHERE qi.created_at >= v_since AND qi.result IN ('aprovado','aprovada')),
    COALESCE(SUM(qi.critical_defects) FILTER (WHERE qi.created_at >= v_since), 0)
  INTO v_total, v_approved, v_critical_defs
  FROM public.quality_inspections qi
  JOIN public.production_orders po ON po.id = qi.production_order_id
  WHERE po.product_id = NEW.product_id AND po.owner_id = NEW.owner_id;

  IF v_total > 0 THEN
    v_fpy := (v_approved::numeric / v_total::numeric) * 100;
  END IF;

  SELECT COUNT(*) INTO v_occs
    FROM public.production_occurrences oc
    JOIN public.production_orders po ON po.id = oc.production_order_id
   WHERE po.product_id = NEW.product_id
     AND po.owner_id = NEW.owner_id
     AND oc.created_at >= v_since;

  IF v_critical_defs > v_max_crit
     OR (v_total >= v_min_insp AND v_fpy < v_fpy_thr)
     OR v_occs >= v_min_occs THEN
    v_is_critical := true;
  END IF;

  IF NOT v_is_critical THEN RETURN NEW; END IF;

  v_severity := CASE
    WHEN v_critical_defs > v_max_crit OR v_fpy < (v_fpy_thr - 20) THEN 'critica'
    WHEN v_fpy < (v_fpy_thr - 5) OR v_occs >= (v_min_occs + 2) THEN 'alta'
    ELSE 'media'
  END;

  v_reason := 'Produto "' || COALESCE(v_product_name,'?') ||
    COALESCE(' (' || v_product_sku || ')','') ||
    '" enviado ao influenciador ' || COALESCE(v_influencer_name,'?') ||
    ' com indicadores críticos nos últimos ' || v_window::text || ' dias: ' ||
    'FPY ' || ROUND(v_fpy,0)::text || '% (limite ' || v_fpy_thr::text || '%) em ' || v_total::text || ' inspeções, ' ||
    v_critical_defs::text || ' defeitos críticos (máx ' || v_max_crit::text || '), ' ||
    v_occs::text || ' ocorrências (gatilho ' || v_min_occs::text || '). ' || v_marker;

  INSERT INTO public.quality_capa(
    owner_id, title, problem, severity, status,
    corrective_action, preventive_action, due_date
  ) VALUES (
    NEW.owner_id,
    'CAPA · Envio a influenciador de produto crítico',
    v_reason,
    v_severity,
    'aberta',
    'Pausar novos envios deste produto a influenciadores até FPY ≥ ' || (v_fpy_thr + 10)::text || '% por 30 dias. Acionar pós-venda para acompanhar peça enviada.',
    'Definir gate em Marketing × Qualidade: produtos críticos ficam bloqueados para envio até CAPA da causa raiz ser verificada.',
    CURRENT_DATE + INTERVAL '5 days'
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.influencer_shipments_autocapa() FROM PUBLIC, anon, authenticated;
