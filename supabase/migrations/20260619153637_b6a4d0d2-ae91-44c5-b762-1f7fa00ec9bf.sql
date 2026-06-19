
-- Auto-CAPA: quando inspeção é reprovada, abre CAPA automaticamente (idempotente)
CREATE OR REPLACE FUNCTION public.quality_inspections_autocapa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sev text;
  marker text;
BEGIN
  IF NEW.result IS DISTINCT FROM 'reprovado' AND NEW.result IS DISTINCT FROM 'reprovada' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD.result = NEW.result) THEN
    RETURN NEW;
  END IF;

  -- evita duplicação
  IF EXISTS (SELECT 1 FROM public.quality_capa WHERE inspection_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  sev := CASE
    WHEN COALESCE(NEW.critical_defects,0) > 0 THEN 'critica'
    WHEN COALESCE(NEW.major_defects,0) >= 3 THEN 'alta'
    WHEN COALESCE(NEW.major_defects,0) >= 1 THEN 'media'
    ELSE 'baixa'
  END;

  marker := '[insp:' || NEW.id::text || ']';

  INSERT INTO public.quality_capa(
    owner_id, inspection_id, supplier_id, order_id,
    title, problem, severity, status, due_date
  ) VALUES (
    NEW.owner_id, NEW.id, NEW.supplier_id, NEW.production_order_id,
    'CAPA · Inspeção reprovada ' || COALESCE('('||NEW.inspection_type||')',''),
    'Inspeção reprovada. Defeitos: '
      || COALESCE(NEW.critical_defects,0)::text || ' críticos, '
      || COALESCE(NEW.major_defects,0)::text || ' maiores, '
      || COALESCE(NEW.minor_defects,0)::text || ' menores. ' || marker,
    sev, 'aberta',
    CURRENT_DATE + INTERVAL '7 days'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quality_inspections_autocapa_trg ON public.quality_inspections;
CREATE TRIGGER quality_inspections_autocapa_trg
AFTER INSERT OR UPDATE OF result ON public.quality_inspections
FOR EACH ROW EXECUTE FUNCTION public.quality_inspections_autocapa();
