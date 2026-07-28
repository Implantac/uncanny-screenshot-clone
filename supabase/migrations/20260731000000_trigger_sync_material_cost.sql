-- Migration: Trigger ON UPDATE para sincronizar custo dos materiais
-- Quando material_library.reference_cost muda, atualiza
-- tech_sheet_materials.unit_cost onde material_id corresponde.
-- Criado: 2026-07-31

-- 1. Função trigger que atualiza os custos
CREATE OR REPLACE FUNCTION sync_material_cost_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar custo unitário nas fichas técnicas onde este material está vinculado
  UPDATE tech_sheet_materials
  SET
    unit_cost = NEW.reference_cost,
    total_cost = consumption * NEW.reference_cost * (1 + COALESCE(loss_pct, 0) / 100),
    updated_at = NOW()
  WHERE
    material_id = NEW.id
    AND unit_cost IS DISTINCT FROM NEW.reference_cost;

  -- Atualizar custos consolidados das fichas técnicas afetadas
  WITH affected_sheets AS (
    SELECT DISTINCT tech_sheet_id
    FROM tech_sheet_materials
    WHERE material_id = NEW.id
  )
  UPDATE tech_sheets ts
  SET
    materials_cost = (
      SELECT COALESCE(SUM(total_cost), 0)
      FROM tech_sheet_materials
      WHERE tech_sheet_id = ts.id
    ),
    cost_price = (
      SELECT COALESCE(SUM(total_cost), 0)
      FROM tech_sheet_materials
      WHERE tech_sheet_id = ts.id
    ) + COALESCE(ts.labor_cost, 0) * (1 + COALESCE(ts.overhead_pct, 0) / 100),
    updated_at = NOW()
  FROM affected_sheets a
  WHERE ts.id = a.tech_sheet_id;

  RETURN NEW;
END;
$$;

-- 2. Trigger ON UPDATE em material_library
DROP TRIGGER IF EXISTS trg_sync_material_cost_on_update ON material_library;
CREATE TRIGGER trg_sync_material_cost_on_update
  AFTER UPDATE OF reference_cost ON material_library
  FOR EACH ROW
  WHEN (OLD.reference_cost IS DISTINCT FROM NEW.reference_cost)
  EXECUTE FUNCTION sync_material_cost_on_update();

-- 3. Função para sincronização em lote (usada pelo botão "Sincronizar todos")
CREATE OR REPLACE FUNCTION batch_sync_material_costs(p_owner_id UUID DEFAULT NULL)
RETURNS TABLE(
  updated_materials BIGINT,
  updated_sheets BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mat_count BIGINT;
  v_sheet_count BIGINT;
BEGIN
  -- Atualizar materiais nas fichas técnicas
  WITH updated AS (
    UPDATE tech_sheet_materials tsm
    SET
      unit_cost = ml.reference_cost,
      total_cost = tsm.consumption * ml.reference_cost * (1 + COALESCE(tsm.loss_pct, 0) / 100),
      updated_at = NOW()
    FROM material_library ml
    WHERE
      tsm.material_id = ml.id
      AND tsm.unit_cost IS DISTINCT FROM ml.reference_cost
      AND (p_owner_id IS NULL OR tsm.owner_id = p_owner_id)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_mat_count FROM updated;

  -- Atualizar fichas técnicas consolidadas
  WITH affected AS (
    SELECT DISTINCT tsm.tech_sheet_id
    FROM tech_sheet_materials tsm
    WHERE (p_owner_id IS NULL OR tsm.owner_id = p_owner_id)
  ),
  updated_sheets AS (
    UPDATE tech_sheets ts
    SET
      materials_cost = (
        SELECT COALESCE(SUM(total_cost), 0)
        FROM tech_sheet_materials
        WHERE tech_sheet_id = ts.id
      ),
      cost_price = (
        SELECT COALESCE(SUM(total_cost), 0)
        FROM tech_sheet_materials
        WHERE tech_sheet_id = ts.id
      ) + COALESCE(ts.labor_cost, 0) * (1 + COALESCE(ts.overhead_pct, 0) / 100),
      updated_at = NOW()
    FROM affected a
    WHERE ts.id = a.tech_sheet_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_sheet_count FROM updated_sheets;

  RETURN QUERY SELECT v_mat_count, v_sheet_count;
END;
$$;

-- 4. Remover material_id de tech_sheet_materials se precisar de FK (opcional)
-- Descomente se quiser garantir integridade referencial:
-- ALTER TABLE tech_sheet_materials
--   ADD CONSTRAINT fk_tech_sheet_materials_material
--   FOREIGN KEY (material_id) REFERENCES material_library(id)
--   ON DELETE SET NULL;

-- Nota: Esta migration adiciona as colunas updated_at se não existirem
ALTER TABLE tech_sheet_materials
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE tech_sheets
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

