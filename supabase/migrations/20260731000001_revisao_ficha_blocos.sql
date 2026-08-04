-- ============================================================
-- Revisão Profunda da Ficha Técnica — Materiais tipados
-- Permite classificar materiais dentro da ficha (Tecido, Malha,
-- Forro, Aviamento, Etiqueta, Embalagem, Serviço...) e enriquecer
-- o BOM com código/descrição/fornecedor/cor sem quebrar o schema.
-- ============================================================

ALTER TABLE public.tech_sheet_materials
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS color text;

COMMENT ON COLUMN public.tech_sheet_materials.type IS
  'Tipo do material na ficha: Tecido, Malha, Forro, Botão, Zíper, Linha, Elástico, Etiqueta, Tag, Embalagem, Renda, Entretela, Aviamento, Insumo de lavanderia, Serviço de estamparia, Serviço de bordado.';
COMMENT ON COLUMN public.tech_sheet_materials.code IS
  'Código do material (da biblioteca global ou manual).';
COMMENT ON COLUMN public.tech_sheet_materials.description IS
  'Descrição técnica do material na ficha.';
COMMENT ON COLUMN public.tech_sheet_materials.supplier IS
  'Nome do fornecedor principal (snapshot, evita join).';
COMMENT ON COLUMN public.tech_sheet_materials.color IS
  'Cor do material na ficha (ex.: Areia, Branco).';

CREATE INDEX IF NOT EXISTS idx_tsm_type ON public.tech_sheet_materials(tech_sheet_id, type);

