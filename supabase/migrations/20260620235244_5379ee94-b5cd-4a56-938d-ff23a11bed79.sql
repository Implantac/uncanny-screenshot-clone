ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS lead_time_days integer NULL;

COMMENT ON COLUMN public.suppliers.lead_time_days IS
  'Lead-time padrão do fornecedor em dias. Usado no cálculo dinâmico do ponto de reposição do almoxarifado.';