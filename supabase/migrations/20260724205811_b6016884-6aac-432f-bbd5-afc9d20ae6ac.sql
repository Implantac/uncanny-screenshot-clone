-- Sprint A: vínculo forte BOM ↔ Biblioteca de Materiais
ALTER TABLE public.tech_sheet_materials
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.material_library(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tech_sheet_materials_material_id
  ON public.tech_sheet_materials(material_id);

UPDATE public.tech_sheet_materials tsm
   SET material_id = ml.id
  FROM public.material_library ml
 WHERE tsm.material_id IS NULL
   AND tsm.owner_id = ml.owner_id
   AND tsm.name IS NOT NULL
   AND ml.name IS NOT NULL
   AND lower(regexp_replace(trim(tsm.name), '\s+', ' ', 'g'))
     = lower(regexp_replace(trim(ml.name), '\s+', ' ', 'g'));

CREATE OR REPLACE FUNCTION public.material_library_flag_bom_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_reason text;
  v_updated int := 0;
  v_supplier_changed boolean;
  v_cost_changed boolean;
BEGIN
  v_supplier_changed := NEW.preferred_supplier_id IS DISTINCT FROM OLD.preferred_supplier_id;
  v_cost_changed := NEW.reference_cost IS DISTINCT FROM OLD.reference_cost;

  IF NOT v_supplier_changed AND NOT v_cost_changed THEN
    RETURN NEW;
  END IF;

  IF NEW.name IS NULL OR length(trim(NEW.name)) = 0 THEN
    RETURN NEW;
  END IF;

  v_key := lower(regexp_replace(trim(NEW.name), '\s+', ' ', 'g'));

  v_reason := CASE
    WHEN v_cost_changed AND v_supplier_changed THEN
      'Fornecedor e custo do material "' || NEW.name || '" foram alterados — revisar custo.'
    WHEN v_cost_changed THEN
      'Custo de referência do material "' || NEW.name || '" foi alterado (R$ '
        || COALESCE(OLD.reference_cost::text,'0') || ' → R$ '
        || COALESCE(NEW.reference_cost::text,'0') || ') — revisar ficha.'
    ELSE
      'Fornecedor preferido do material "' || NEW.name || '" foi alterado — revisar custo.'
  END;

  WITH targets AS (
    SELECT DISTINCT ts.id
      FROM public.tech_sheets ts
      JOIN public.tech_sheet_materials tsm ON tsm.tech_sheet_id = ts.id
     WHERE ts.owner_id = NEW.owner_id
       AND ts.status IN ('rascunho', 'em_revisao')
       AND (
         tsm.material_id = NEW.id
         OR (
           tsm.material_id IS NULL
           AND tsm.name IS NOT NULL
           AND lower(regexp_replace(trim(tsm.name), '\s+', ' ', 'g')) = v_key
         )
       )
  )
  UPDATE public.tech_sheets ts
     SET needs_cost_review = true,
         cost_review_reason = v_reason,
         cost_review_flagged_at = now()
    FROM targets
   WHERE ts.id = targets.id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    PERFORM public.log_audit(
      'material_library',
      NEW.id,
      'bom_review_flagged',
      jsonb_build_object(
        'material_key', v_key,
        'material_name', NEW.name,
        'supplier_changed', v_supplier_changed,
        'cost_changed', v_cost_changed,
        'new_supplier_id', NEW.preferred_supplier_id,
        'previous_supplier_id', OLD.preferred_supplier_id,
        'new_reference_cost', NEW.reference_cost,
        'previous_reference_cost', OLD.reference_cost,
        'tech_sheets_flagged', v_updated
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.material_library_usage(_material_id uuid)
RETURNS TABLE(
  tech_sheet_id uuid,
  tech_sheet_code text,
  tech_sheet_version text,
  tech_sheet_status text,
  tech_sheet_updated_at timestamptz,
  product_id uuid,
  product_sku text,
  product_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT
    ts.id, ts.code, ts.version, ts.status::text, ts.updated_at,
    p.id, p.sku, p.name
  FROM public.tech_sheet_materials tsm
  JOIN public.tech_sheets ts ON ts.id = tsm.tech_sheet_id
  LEFT JOIN public.products p ON p.id = ts.product_id
  WHERE tsm.material_id = _material_id
    AND ts.owner_id = auth.uid()
  ORDER BY ts.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.material_library_usage(uuid) TO authenticated;