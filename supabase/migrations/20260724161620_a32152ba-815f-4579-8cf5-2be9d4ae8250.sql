
-- Wave 32 — BOM propagation: sinalizar fichas técnicas consumindo material com fornecedor trocado

ALTER TABLE public.tech_sheets
  ADD COLUMN IF NOT EXISTS needs_cost_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost_review_reason text,
  ADD COLUMN IF NOT EXISTS cost_review_flagged_at timestamptz;

CREATE INDEX IF NOT EXISTS tech_sheets_needs_cost_review_idx
  ON public.tech_sheets (owner_id, needs_cost_review)
  WHERE needs_cost_review = true;

CREATE OR REPLACE FUNCTION public.material_library_flag_bom_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_reason text;
  v_updated int;
BEGIN
  -- Only react when preferred_supplier_id actually changes
  IF NEW.preferred_supplier_id IS NOT DISTINCT FROM OLD.preferred_supplier_id THEN
    RETURN NEW;
  END IF;
  IF NEW.name IS NULL OR length(trim(NEW.name)) = 0 THEN
    RETURN NEW;
  END IF;

  v_key := lower(regexp_replace(trim(NEW.name), '\s+', ' ', 'g'));
  v_reason := 'Fornecedor preferido do material "' || NEW.name || '" foi alterado — revisar custo.';

  WITH targets AS (
    SELECT DISTINCT ts.id
    FROM public.tech_sheets ts
    JOIN public.tech_sheet_materials tsm ON tsm.tech_sheet_id = ts.id
    WHERE ts.owner_id = NEW.owner_id
      AND ts.status IN ('rascunho', 'em_revisao')
      AND tsm.name IS NOT NULL
      AND lower(regexp_replace(trim(tsm.name), '\s+', ' ', 'g')) = v_key
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
        'new_supplier_id', NEW.preferred_supplier_id,
        'previous_supplier_id', OLD.preferred_supplier_id,
        'tech_sheets_flagged', v_updated
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_material_library_flag_bom_review ON public.material_library;
CREATE TRIGGER trg_material_library_flag_bom_review
AFTER UPDATE OF preferred_supplier_id ON public.material_library
FOR EACH ROW
EXECUTE FUNCTION public.material_library_flag_bom_review();
