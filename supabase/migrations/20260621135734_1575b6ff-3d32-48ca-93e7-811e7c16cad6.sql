
ALTER TABLE public.tech_sheets
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_note text;

CREATE OR REPLACE FUNCTION public.tech_sheets_stamp_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_next int;
  v_snapshot jsonb;
  v_sheet jsonb;
  v_materials jsonb;
  v_operations jsonb;
  v_measurements jsonb;
BEGIN
  -- Aprovação (transição para 'aprovada')
  IF NEW.status = 'aprovada' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'aprovada') THEN
    NEW.approved_by := COALESCE(NEW.approved_by, v_uid);
    NEW.approved_at := COALESCE(NEW.approved_at, now());

    -- Snapshot imutável em tech_sheet_versions
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next
      FROM public.tech_sheet_versions WHERE tech_sheet_id = NEW.id;

    SELECT to_jsonb(t.*) INTO v_sheet FROM public.tech_sheets t WHERE t.id = NEW.id;
    SELECT COALESCE(jsonb_agg(to_jsonb(m.*)), '[]'::jsonb) INTO v_materials
      FROM public.tech_sheet_materials m WHERE m.tech_sheet_id = NEW.id;
    SELECT COALESCE(jsonb_agg(to_jsonb(o.*)), '[]'::jsonb) INTO v_operations
      FROM public.tech_sheet_operations o WHERE o.tech_sheet_id = NEW.id;
    SELECT COALESCE(jsonb_agg(to_jsonb(ms.*)), '[]'::jsonb) INTO v_measurements
      FROM public.tech_sheet_measurements ms WHERE ms.tech_sheet_id = NEW.id;

    v_snapshot := jsonb_build_object(
      'sheet', COALESCE(v_sheet, 'null'::jsonb),
      'materials', v_materials,
      'operations', v_operations,
      'measurements', v_measurements
    );

    INSERT INTO public.tech_sheet_versions(
      owner_id, tech_sheet_id, version_number, label, notes, snapshot, created_by
    ) VALUES (
      NEW.owner_id, NEW.id, v_next,
      'Aprovação v' || v_next::text,
      NEW.approval_note,
      v_snapshot,
      v_uid
    );

    PERFORM public.log_audit('tech_sheet', NEW.id, 'approved',
      jsonb_build_object('approved_by', NEW.approved_by, 'version', v_next));
  END IF;

  -- Revogação (deixa de ser 'aprovada')
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovada' AND NEW.status IS DISTINCT FROM 'aprovada' THEN
    PERFORM public.log_audit('tech_sheet', NEW.id, 'revoked',
      jsonb_build_object('previous_approved_by', OLD.approved_by, 'previous_approved_at', OLD.approved_at));
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.approval_note := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tech_sheets_stamp_approval ON public.tech_sheets;
CREATE TRIGGER trg_tech_sheets_stamp_approval
  BEFORE INSERT OR UPDATE OF status ON public.tech_sheets
  FOR EACH ROW EXECUTE FUNCTION public.tech_sheets_stamp_approval();
