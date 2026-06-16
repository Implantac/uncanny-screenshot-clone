-- M01: setor atual + sinalizador de ajuste no protótipo
ALTER TABLE public.prototypes
  ADD COLUMN IF NOT EXISTS current_sector text
    CHECK (current_sector IN ('modelagem','corte','silk','bordado','costura','lavanderia','acabamento','aprovacao')),
  ADD COLUMN IF NOT EXISTS needs_adjustment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adjustment_reason text,
  ADD COLUMN IF NOT EXISTS adjustment_requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adjustment_requested_at timestamptz;

-- Histórico de ajustes (motivo, responsável, anexos)
CREATE TABLE IF NOT EXISTS public.prototype_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prototype_id uuid NOT NULL REFERENCES public.prototypes(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  sector text,
  reason text NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','concluido','cancelado')),
  notes text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{url, kind:'photo'|'video', name?}]
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prototype_adjustments TO authenticated;
GRANT ALL ON public.prototype_adjustments TO service_role;

ALTER TABLE public.prototype_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can read adjustments"
  ON public.prototype_adjustments FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "owner can insert adjustments"
  ON public.prototype_adjustments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owner can update adjustments"
  ON public.prototype_adjustments FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "owner can delete adjustments"
  ON public.prototype_adjustments FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_proto_adj_proto ON public.prototype_adjustments(prototype_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proto_adj_owner ON public.prototype_adjustments(owner_id);

CREATE TRIGGER trg_proto_adj_updated_at
  BEFORE UPDATE ON public.prototype_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();