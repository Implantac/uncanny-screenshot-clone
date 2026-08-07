-- ============================================================
-- Blocos técnicos transacionais — migração de JSON para tabelas
-- (Sprint 3 · 3.1)
--
-- Cada bloco da ficha técnica (composição, beneficiamentos,
-- estamparia, bordado, lavanderia, embalagem, qualidade) ganha
-- uma tabela dedicada, permitindo relatórios/BI por bloco.
--
-- Retrocompatibilidade: mantemos o JSON `tech_sheets.content`
-- sincronizado via trigger, e a leitura faz fallback para o JSON
-- quando a tabela estiver vazia.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Composição
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tech_sheet_composition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  fiber text,
  pct text,
  notes text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_composition TO authenticated;
GRANT ALL ON public.tech_sheet_composition TO service_role;
ALTER TABLE public.tech_sheet_composition ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own comp select" ON public.tech_sheet_composition FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own comp insert" ON public.tech_sheet_composition FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own comp update" ON public.tech_sheet_composition FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own comp delete" ON public.tech_sheet_composition FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER tsc_updated BEFORE UPDATE ON public.tech_sheet_composition FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tsc_ts_idx ON public.tech_sheet_composition(tech_sheet_id);

-- ------------------------------------------------------------
-- 2) Beneficiamentos / Tratamentos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tech_sheet_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  type text,
  description text,
  supplier text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_treatments TO authenticated;
GRANT ALL ON public.tech_sheet_treatments TO service_role;
ALTER TABLE public.tech_sheet_treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own treat select" ON public.tech_sheet_treatments FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own treat insert" ON public.tech_sheet_treatments FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own treat update" ON public.tech_sheet_treatments FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own treat delete" ON public.tech_sheet_treatments FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER tst_updated BEFORE UPDATE ON public.tech_sheet_treatments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tst_ts_idx ON public.tech_sheet_treatments(tech_sheet_id);

-- ------------------------------------------------------------
-- 3) Estamparia
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tech_sheet_printing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  technique text,
  colors text,
  supplier text,
  notes text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_printing TO authenticated;
GRANT ALL ON public.tech_sheet_printing TO service_role;
ALTER TABLE public.tech_sheet_printing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own print select" ON public.tech_sheet_printing FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own print insert" ON public.tech_sheet_printing FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own print update" ON public.tech_sheet_printing FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own print delete" ON public.tech_sheet_printing FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER tsp_updated BEFORE UPDATE ON public.tech_sheet_printing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tsp_ts_idx ON public.tech_sheet_printing(tech_sheet_id);

-- ------------------------------------------------------------
-- 4) Bordado
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tech_sheet_embroidery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  technique text,
  stitch text,
  supplier text,
  notes text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_embroidery TO authenticated;
GRANT ALL ON public.tech_sheet_embroidery TO service_role;
ALTER TABLE public.tech_sheet_embroidery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own emb select" ON public.tech_sheet_embroidery FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own emb insert" ON public.tech_sheet_embroidery FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own emb update" ON public.tech_sheet_embroidery FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own emb delete" ON public.tech_sheet_embroidery FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER tse_updated BEFORE UPDATE ON public.tech_sheet_embroidery FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tse_ts_idx ON public.tech_sheet_embroidery(tech_sheet_id);

-- ------------------------------------------------------------
-- 5) Lavanderia
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tech_sheet_laundry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  wash text,
  supplier text,
  instructions text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_laundry TO authenticated;
GRANT ALL ON public.tech_sheet_laundry TO service_role;
ALTER TABLE public.tech_sheet_laundry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lau select" ON public.tech_sheet_laundry FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own lau insert" ON public.tech_sheet_laundry FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own lau update" ON public.tech_sheet_laundry FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own lau delete" ON public.tech_sheet_laundry FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER tslau_updated BEFORE UPDATE ON public.tech_sheet_laundry FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tslau_ts_idx ON public.tech_sheet_laundry(tech_sheet_id);

-- ------------------------------------------------------------
-- 6) Embalagem
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tech_sheet_packaging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  type text,
  material text,
  dims text,
  notes text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_packaging TO authenticated;
GRANT ALL ON public.tech_sheet_packaging TO service_role;
ALTER TABLE public.tech_sheet_packaging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pack select" ON public.tech_sheet_packaging FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own pack insert" ON public.tech_sheet_packaging FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own pack update" ON public.tech_sheet_packaging FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own pack delete" ON public.tech_sheet_packaging FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER tspa_updated BEFORE UPDATE ON public.tech_sheet_packaging FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tspa_ts_idx ON public.tech_sheet_packaging(tech_sheet_id);

-- ------------------------------------------------------------
-- 7) Instruções de qualidade
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tech_sheet_quality (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  instruction text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tech_sheet_quality TO authenticated;
GRANT ALL ON public.tech_sheet_quality TO service_role;
ALTER TABLE public.tech_sheet_quality ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own qual select" ON public.tech_sheet_quality FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own qual insert" ON public.tech_sheet_quality FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own qual update" ON public.tech_sheet_quality FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own qual delete" ON public.tech_sheet_quality FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER tsq_updated BEFORE UPDATE ON public.tech_sheet_quality FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS tsq_ts_idx ON public.tech_sheet_quality(tech_sheet_id);

-- ============================================================
-- Migração de dados idempotente: content JSON -> tabelas
-- Só insere quando a tabela ainda está vazia para a ficha
-- (evita duplicação em re-execução).
-- ============================================================
DO $$
DECLARE
  v_sheet record;
  v_block jsonb;
  v_j jsonb;
  v_pos int;
  v_owner uuid;
  v_count int;
BEGIN
  FOR v_sheet IN
    SELECT ts.id, ts.owner_id, ts.content
      FROM public.tech_sheets ts
  LOOP
    v_owner := v_sheet.owner_id;
    IF v_sheet.content IS NULL OR v_sheet.content = '' THEN
      CONTINUE;
    END IF;

    -- composition
    SELECT COUNT(*) INTO v_count FROM public.tech_sheet_composition WHERE tech_sheet_id = v_sheet.id;
    IF v_count = 0 THEN
      v_block := COALESCE((v_sheet.content::jsonb)->'composition', '[]'::jsonb);
      v_pos := 0;
      FOR v_j IN SELECT * FROM jsonb_array_elements(v_block) LOOP
        IF jsonb_typeof(v_j) = 'object' THEN
          INSERT INTO public.tech_sheet_composition
            (owner_id, tech_sheet_id, fiber, pct, notes, position)
          VALUES
            (v_owner, v_sheet.id,
             NULLIF(trim(v_j->>'fiber'), ''),
             NULLIF(trim(v_j->>'pct'), ''),
             NULLIF(trim(v_j->>'notes'), ''),
             v_pos);
          v_pos := v_pos + 1;
        END IF;
      END LOOP;
    END IF;

    -- treatments
    SELECT COUNT(*) INTO v_count FROM public.tech_sheet_treatments WHERE tech_sheet_id = v_sheet.id;
    IF v_count = 0 THEN
      v_block := COALESCE((v_sheet.content::jsonb)->'treatments', '[]'::jsonb);
      v_pos := 0;
      FOR v_j IN SELECT * FROM jsonb_array_elements(v_block) LOOP
        IF jsonb_typeof(v_j) = 'object' THEN
          INSERT INTO public.tech_sheet_treatments
            (owner_id, tech_sheet_id, type, description, supplier, position)
          VALUES
            (v_owner, v_sheet.id,
             NULLIF(trim(v_j->>'type'), ''),
             NULLIF(trim(v_j->>'description'), ''),
             NULLIF(trim(v_j->>'supplier'), ''),
             v_pos);
          v_pos := v_pos + 1;
        END IF;
      END LOOP;
    END IF;

    -- printing
    SELECT COUNT(*) INTO v_count FROM public.tech_sheet_printing WHERE tech_sheet_id = v_sheet.id;
    IF v_count = 0 THEN
      v_block := COALESCE((v_sheet.content::jsonb)->'printing', '[]'::jsonb);
      v_pos := 0;
      FOR v_j IN SELECT * FROM jsonb_array_elements(v_block) LOOP
        IF jsonb_typeof(v_j) = 'object' THEN
          INSERT INTO public.tech_sheet_printing
            (owner_id, tech_sheet_id, technique, colors, supplier, notes, position)
          VALUES
            (v_owner, v_sheet.id,
             NULLIF(trim(v_j->>'technique'), ''),
             NULLIF(trim(v_j->>'colors'), ''),
             NULLIF(trim(v_j->>'supplier'), ''),
             NULLIF(trim(v_j->>'notes'), ''),
             v_pos);
          v_pos := v_pos + 1;
        END IF;
      END LOOP;
    END IF;

    -- embroidery
    SELECT COUNT(*) INTO v_count FROM public.tech_sheet_embroidery WHERE tech_sheet_id = v_sheet.id;
    IF v_count = 0 THEN
      v_block := COALESCE((v_sheet.content::jsonb)->'embroidery', '[]'::jsonb);
      v_pos := 0;
      FOR v_j IN SELECT * FROM jsonb_array_elements(v_block) LOOP
        IF jsonb_typeof(v_j) = 'object' THEN
          INSERT INTO public.tech_sheet_embroidery
            (owner_id, tech_sheet_id, technique, stitch, supplier, notes, position)
          VALUES
            (v_owner, v_sheet.id,
             NULLIF(trim(v_j->>'technique'), ''),
             NULLIF(trim(v_j->>'stitch'), ''),
             NULLIF(trim(v_j->>'supplier'), ''),
             NULLIF(trim(v_j->>'notes'), ''),
             v_pos);
          v_pos := v_pos + 1;
        END IF;
      END LOOP;
    END IF;

    -- laundry
    SELECT COUNT(*) INTO v_count FROM public.tech_sheet_laundry WHERE tech_sheet_id = v_sheet.id;
    IF v_count = 0 THEN
      v_block := COALESCE((v_sheet.content::jsonb)->'laundry', '[]'::jsonb);
      v_pos := 0;
      FOR v_j IN SELECT * FROM jsonb_array_elements(v_block) LOOP
        IF jsonb_typeof(v_j) = 'object' THEN
          INSERT INTO public.tech_sheet_laundry
            (owner_id, tech_sheet_id, wash, supplier, instructions, position)
          VALUES
            (v_owner, v_sheet.id,
             NULLIF(trim(v_j->>'wash'), ''),
             NULLIF(trim(v_j->>'supplier'), ''),
             NULLIF(trim(v_j->>'instructions'), ''),
             v_pos);
          v_pos := v_pos + 1;
        END IF;
      END LOOP;
    END IF;

    -- packaging
    SELECT COUNT(*) INTO v_count FROM public.tech_sheet_packaging WHERE tech_sheet_id = v_sheet.id;
    IF v_count = 0 THEN
      v_block := COALESCE((v_sheet.content::jsonb)->'packaging', '[]'::jsonb);
      v_pos := 0;
      FOR v_j IN SELECT * FROM jsonb_array_elements(v_block) LOOP
        IF jsonb_typeof(v_j) = 'object' THEN
          INSERT INTO public.tech_sheet_packaging
            (owner_id, tech_sheet_id, type, material, dims, notes, position)
          VALUES
            (v_owner, v_sheet.id,
             NULLIF(trim(v_j->>'type'), ''),
             NULLIF(trim(v_j->>'material'), ''),
             NULLIF(trim(v_j->>'dims'), ''),
             NULLIF(trim(v_j->>'notes'), ''),
             v_pos);
          v_pos := v_pos + 1;
        END IF;
      END LOOP;
    END IF;

    -- quality
    SELECT COUNT(*) INTO v_count FROM public.tech_sheet_quality WHERE tech_sheet_id = v_sheet.id;
    IF v_count = 0 THEN
      v_block := COALESCE((v_sheet.content::jsonb)->'quality', '[]'::jsonb);
      v_pos := 0;
      FOR v_j IN SELECT * FROM jsonb_array_elements(v_block) LOOP
        IF jsonb_typeof(v_j) = 'object' THEN
          INSERT INTO public.tech_sheet_quality
            (owner_id, tech_sheet_id, instruction, position)
          VALUES
            (v_owner, v_sheet.id,
             NULLIF(trim(v_j->>'instruction'), ''),
             v_pos);
          v_pos := v_pos + 1;
        END IF;
      END LOOP;
    END IF;

  END LOOP;
END $$;

-- ============================================================
-- Trigger de sincronização: tabela -> content (retrocompat)
-- Qualquer INSERT/UPDATE/DELETE em um bloco reconstrói o array
-- correspondente no JSON `tech_sheets.content`.
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_block_to_json()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sheet_id uuid;
  v_block text;
  v_owner uuid;
  v_rows jsonb;
  v_content jsonb;
  v_new_content jsonb;
BEGIN
  v_sheet_id := COALESCE(NEW.tech_sheet_id, OLD.tech_sheet_id);
  v_block := TG_ARGV[0];

  SELECT owner_id INTO v_owner FROM public.tech_sheets WHERE id = v_sheet_id;
  IF v_owner IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(content, '{}'::jsonb) INTO v_content FROM public.tech_sheets WHERE id = v_sheet_id;
  IF jsonb_typeof(v_content) = 'string' THEN
    BEGIN
      v_content := v_content::text::jsonb;
    EXCEPTION WHEN OTHERS THEN
      v_content := '{}'::jsonb;
    END;
  END IF;

  -- Reconstrói o array do bloco a partir da tabela correspondente
  CASE v_block
    WHEN 'composition' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'fiber', fiber, 'pct', pct, 'notes', notes
      ) ORDER BY position), '[]'::jsonb)
      INTO v_rows FROM public.tech_sheet_composition WHERE tech_sheet_id = v_sheet_id;
    WHEN 'treatments' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', type, 'description', description, 'supplier', supplier
      ) ORDER BY position), '[]'::jsonb)
      INTO v_rows FROM public.tech_sheet_treatments WHERE tech_sheet_id = v_sheet_id;
    WHEN 'printing' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'technique', technique, 'colors', colors, 'supplier', supplier, 'notes', notes
      ) ORDER BY position), '[]'::jsonb)
      INTO v_rows FROM public.tech_sheet_printing WHERE tech_sheet_id = v_sheet_id;
    WHEN 'embroidery' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'technique', technique, 'stitch', stitch, 'supplier', supplier, 'notes', notes
      ) ORDER BY position), '[]'::jsonb)
      INTO v_rows FROM public.tech_sheet_embroidery WHERE tech_sheet_id = v_sheet_id;
    WHEN 'laundry' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'wash', wash, 'supplier', supplier, 'instructions', instructions
      ) ORDER BY position), '[]'::jsonb)
      INTO v_rows FROM public.tech_sheet_laundry WHERE tech_sheet_id = v_sheet_id;
    WHEN 'packaging' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'type', type, 'material', material, 'dims', dims, 'notes', notes
      ) ORDER BY position), '[]'::jsonb)
      INTO v_rows FROM public.tech_sheet_packaging WHERE tech_sheet_id = v_sheet_id;
    WHEN 'quality' THEN
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'instruction', instruction
      ) ORDER BY position), '[]'::jsonb)
      INTO v_rows FROM public.tech_sheet_quality WHERE tech_sheet_id = v_sheet_id;
    ELSE
      RETURN NULL;
  END CASE;

  v_new_content := v_content || jsonb_build_object(v_block, v_rows);

  UPDATE public.tech_sheets
     SET content = v_new_content,
         updated_at = now()
   WHERE id = v_sheet_id;

  RETURN NULL;
END;
$$;

-- Anexa o trigger a cada tabela de bloco
DROP TRIGGER IF EXISTS trg_comp_sync ON public.tech_sheet_composition;
CREATE TRIGGER trg_comp_sync AFTER INSERT OR UPDATE OR DELETE ON public.tech_sheet_composition
  FOR EACH ROW EXECUTE FUNCTION public.sync_block_to_json('composition');

DROP TRIGGER IF EXISTS trg_treat_sync ON public.tech_sheet_treatments;
CREATE TRIGGER trg_treat_sync AFTER INSERT OR UPDATE OR DELETE ON public.tech_sheet_treatments
  FOR EACH ROW EXECUTE FUNCTION public.sync_block_to_json('treatments');

DROP TRIGGER IF EXISTS trg_print_sync ON public.tech_sheet_printing;
CREATE TRIGGER trg_print_sync AFTER INSERT OR UPDATE OR DELETE ON public.tech_sheet_printing
  FOR EACH ROW EXECUTE FUNCTION public.sync_block_to_json('printing');

DROP TRIGGER IF EXISTS trg_emb_sync ON public.tech_sheet_embroidery;
CREATE TRIGGER trg_emb_sync AFTER INSERT OR UPDATE OR DELETE ON public.tech_sheet_embroidery
  FOR EACH ROW EXECUTE FUNCTION public.sync_block_to_json('embroidery');

DROP TRIGGER IF EXISTS trg_laundry_sync ON public.tech_sheet_laundry;
CREATE TRIGGER trg_laundry_sync AFTER INSERT OR UPDATE OR DELETE ON public.tech_sheet_laundry
  FOR EACH ROW EXECUTE FUNCTION public.sync_block_to_json('laundry');

DROP TRIGGER IF EXISTS trg_pack_sync ON public.tech_sheet_packaging;
CREATE TRIGGER trg_pack_sync AFTER INSERT OR UPDATE OR DELETE ON public.tech_sheet_packaging
  FOR EACH ROW EXECUTE FUNCTION public.sync_block_to_json('packaging');

DROP TRIGGER IF EXISTS trg_qual_sync ON public.tech_sheet_quality;
CREATE TRIGGER trg_qual_sync AFTER INSERT OR UPDATE OR DELETE ON public.tech_sheet_quality
  FOR EACH ROW EXECUTE FUNCTION public.sync_block_to_json('quality');
