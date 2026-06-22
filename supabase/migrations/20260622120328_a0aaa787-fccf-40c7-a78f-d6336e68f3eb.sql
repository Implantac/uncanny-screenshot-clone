ALTER TABLE public.tech_sheet_operations
  ADD COLUMN IF NOT EXISTS responsible_role text;

COMMENT ON COLUMN public.tech_sheet_operations.responsible_role IS
  'Papel/setor responsável pela etapa (BOP): ex. corte, costura, acabamento, qualidade, terceiro.';