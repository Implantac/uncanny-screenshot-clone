
CREATE OR REPLACE FUNCTION public.influencer_shipments_autocapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - interval '90 days';
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
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_marker := '[ship-capa:' || NEW.id::text || ']';

  -- dedupe
  IF EXISTS (
    SELECT 1 FROM public.quality_capa
     WHERE owner_id = NEW.owner_id
       AND problem LIKE '%' || v_marker || '%'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT name, sku INTO v_product_name, v_product_sku
    FROM public.products WHERE id = NEW.product_id;

  SELECT nome INTO v_influencer_name
    FROM public.influencers WHERE id = NEW.influencer_id;

  -- FPY + defeitos críticos via inspeções
  SELECT
    COUNT(*) FILTER (WHERE qi.created_at >= v_since),
    COUNT(*) FILTER (WHERE qi.created_at >= v_since AND qi.result IN ('aprovado','aprovada')),
    COALESCE(SUM(qi.critical_defects) FILTER (WHERE qi.created_at >= v_since), 0)
  INTO v_total, v_approved, v_critical_defs
  FROM public.quality_inspections qi
  JOIN public.production_orders po ON po.id = qi.production_order_id
  WHERE po.product_id = NEW.product_id
    AND po.owner_id = NEW.owner_id;

  IF v_total > 0 THEN
    v_fpy := (v_approved::numeric / v_total::numeric) * 100;
  END IF;

  -- ocorrências de produção nos últimos 90d
  SELECT COUNT(*)
    INTO v_occs
    FROM public.production_occurrences oc
    JOIN public.production_orders po ON po.id = oc.production_order_id
   WHERE po.product_id = NEW.product_id
     AND po.owner_id = NEW.owner_id
     AND oc.created_at >= v_since;

  -- regra de criticidade
  IF v_critical_defs > 0 OR (v_total >= 3 AND v_fpy < 80) OR v_occs >= 3 THEN
    v_is_critical := true;
  END IF;

  IF NOT v_is_critical THEN
    RETURN NEW;
  END IF;

  v_severity := CASE
    WHEN v_critical_defs > 0 OR v_fpy < 60 THEN 'critica'
    WHEN v_fpy < 75 OR v_occs >= 5 THEN 'alta'
    ELSE 'media'
  END;

  v_reason := 'Produto "' || COALESCE(v_product_name,'?') ||
    COALESCE(' (' || v_product_sku || ')','') ||
    '" foi enviado ao influenciador ' || COALESCE(v_influencer_name,'?') ||
    ' mesmo com indicadores críticos de qualidade nos últimos 90 dias: ' ||
    'FPY ' || ROUND(v_fpy,0)::text || '% em ' || v_total::text || ' inspeções, ' ||
    v_critical_defs::text || ' defeitos críticos, ' ||
    v_occs::text || ' ocorrências de produção. ' || v_marker;

  INSERT INTO public.quality_capa(
    owner_id, title, problem, severity, status,
    corrective_action, preventive_action, due_date
  ) VALUES (
    NEW.owner_id,
    'CAPA · Envio a influenciador de produto crítico',
    v_reason,
    v_severity,
    'aberta',
    'Pausar novos envios deste produto a influenciadores até FPY ≥ 90% por 30 dias. Acionar pós-venda para acompanhar peça enviada e mitigar risco de exposição negativa.',
    'Definir gate automático em Marketing × Qualidade: produtos com risco "crítico" ficam bloqueados para envio até CAPA da causa raiz ser verificada.',
    CURRENT_DATE + INTERVAL '5 days'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_influencer_shipments_autocapa ON public.influencer_shipments;
CREATE TRIGGER trg_influencer_shipments_autocapa
AFTER INSERT OR UPDATE OF product_id, status ON public.influencer_shipments
FOR EACH ROW EXECUTE FUNCTION public.influencer_shipments_autocapa();
