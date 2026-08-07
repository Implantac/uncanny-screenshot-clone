-- ============================================================
-- Fluxo de Aprovação Multi-etapas da Ficha Técnica
-- Estilo → Modelagem → Compras → Custos → Qualidade → Diretoria → Liberação
-- Reutiliza tech_sheets, tech_sheet_versions e push_notifications.
-- Cada etapa registra usuário, data, status e comentário.
-- ============================================================

CREATE TYPE public.approval_workflow_status AS ENUM (
  'pendente',
  'em_analise',
  'aprovado',
  'reprovado',
  'pulado',
  'cancelado'
);

CREATE TABLE public.approval_workflow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  tech_sheet_id uuid NOT NULL REFERENCES public.tech_sheets(id) ON DELETE CASCADE,
  stage integer NOT NULL,            -- ordem 1..7
  role text NOT NULL,                -- estilo, modelagem, compras, custos, qualidade, diretoria, producao
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.approval_workflow_status NOT NULL DEFAULT 'pendente',
  sent_at timestamptz,
  decided_at timestamptz,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_approval_workflow_stage UNIQUE (tech_sheet_id, stage)
);

CREATE INDEX idx_approval_workflow_sheet ON public.approval_workflow(tech_sheet_id, stage);
CREATE INDEX idx_approval_workflow_product ON public.approval_workflow(product_id);
CREATE INDEX idx_approval_workflow_assigned ON public.approval_workflow(assigned_to, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_workflow TO authenticated;
GRANT ALL ON public.approval_workflow TO service_role;

ALTER TABLE public.approval_workflow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read approval_workflow" ON public.approval_workflow
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = assigned_to);

CREATE POLICY "owner insert approval_workflow" ON public.approval_workflow
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owner update approval_workflow" ON public.approval_workflow
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = assigned_to)
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = assigned_to);

CREATE POLICY "owner delete approval_workflow" ON public.approval_workflow
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE TRIGGER trg_approval_workflow_updated
  BEFORE UPDATE ON public.approval_workflow
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Sincronização do status da ficha com o fluxo de aprovação.
-- Regras:
--   * Todas as etapas aprovadas/puladas → status da ficha = 'aprovada'
--     e já atualiza approved_by/approved_at (rastreável).
--   * Qualquer etapa reprovada → status da ficha = 'em_revisao'
--     (ficha destravada para correção via nova versão).
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_sheet_from_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total int;
  v_done int;
  v_rejected int;
  v_sheet_status public.tech_sheet_status;
BEGIN
  SELECT status INTO v_sheet_status
    FROM public.tech_sheets
   WHERE id = NEW.tech_sheet_id;

  -- Reprovação destrava a ficha e limpa metadados de aprovação
  IF NEW.status = 'reprovado' AND v_sheet_status = 'aprovada' THEN
    UPDATE public.tech_sheets
       SET status = 'em_revisao',
           approved_by = NULL,
           approved_at = NULL,
           approval_note = NULL
     WHERE id = NEW.tech_sheet_id;
    RETURN NEW;
  END IF;

  -- Se qualquer etapa reprovou, ficha volta para em_revisao
  IF NEW.status = 'reprovado' THEN
    UPDATE public.tech_sheets
       SET status = 'em_revisao',
           approved_by = NULL,
           approved_at = NULL,
           approval_note = NULL
     WHERE id = NEW.tech_sheet_id
       AND status = 'rascunho' OR status = 'em_revisao';
    RETURN NEW;
  END IF;

  -- Somente avalia conclusão quando a etapa sai de pendente/em_analise
  IF NEW.status IN ('aprovado','pulado','em_analise') THEN
    SELECT
      COUNT(*) FILTER (WHERE status NOT IN ('pendente','em_analise')),
      COUNT(*) FILTER (WHERE status = 'reprovado')
    INTO v_done, v_rejected
    FROM public.approval_workflow
    WHERE tech_sheet_id = NEW.tech_sheet_id;

    SELECT COUNT(*) INTO v_total
    FROM public.approval_workflow
    WHERE tech_sheet_id = NEW.tech_sheet_id;

    IF v_rejected > 0 THEN
      UPDATE public.tech_sheets
         SET status = 'em_revisao',
             approved_by = NULL,
             approved_at = NULL,
             approval_note = NULL
       WHERE id = NEW.tech_sheet_id
         AND status <> 'aprovada';
    ELSIF v_total > 0 AND v_done = v_total THEN
      -- Todas decididas (aprovadas/puladas) → ficha aprovada
      UPDATE public.tech_sheets
         SET status = 'aprovada',
             approved_by = auth.uid(),
             approved_at = COALESCE(approved_at, now())
       WHERE id = NEW.tech_sheet_id
         AND status <> 'aprovada';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approval_workflow_sync_sheet ON public.approval_workflow;
CREATE TRIGGER trg_approval_workflow_sync_sheet
  AFTER INSERT OR UPDATE ON public.approval_workflow
  FOR EACH ROW EXECUTE FUNCTION public.sync_sheet_from_workflow();

-- ============================================================
-- Helpers idempotentes para inicializar o fluxo padrão de 7 etapas.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_approval_workflow(_tech_sheet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner uuid;
  v_product uuid;
  v_stages text[] := ARRAY[
    'estilo','modelagem','compras','custos','qualidade','diretoria','producao'
  ];
  v_idx int;
BEGIN
  SELECT owner_id, product_id INTO v_owner, v_product
    FROM public.tech_sheets WHERE id = _tech_sheet_id;

  IF v_owner IS NULL THEN RETURN; END IF;

  FOR v_idx IN 1..array_length(v_stages, 1) LOOP
    INSERT INTO public.approval_workflow (owner_id, product_id, tech_sheet_id, stage, role)
    VALUES (v_owner, v_product, _tech_sheet_id, v_idx, v_stages[v_idx])
    ON CONFLICT (tech_sheet_id, stage) DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_approval_workflow(_tech_sheet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.approval_workflow
     SET status = 'pendente',
         sent_at = NULL,
         decided_at = NULL,
         comment = NULL,
         assigned_to = NULL
   WHERE tech_sheet_id = _tech_sheet_id
     AND status IN ('pendente','em_analise');
END;
$$;

